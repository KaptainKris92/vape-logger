// Talks to the Vaper Taper device over Web Bluetooth.
// The protocol is described at the top of firmware/vaper_taper/vaper_taper.ino.

const uuid = (n) => `9d1e${n}-5f6a-4c3b-8e2d-7a6b5c4d3e2f`;
const SERVICE = uuid('0001');
const TIME = uuid('0002');
const STATUS = uuid('0003');
const LOG_CTL = uuid('0004');
const LOG_DATA = uuid('0005');
const END_MARKER = 0xffffffff;

export const supported = 'bluetooth' in navigator;

// Events: 'state' (detail: 'disconnected' | 'connecting' | 'connected'),
// 'status' (detail: status object), 'battery' (detail: %),
// 'records' (detail: { logId, records, total, done }).
export class VaperTaper extends EventTarget {
  constructor() {
    super();
    this.device = null;
    this.state = 'disconnected';
    this.status = null;
    this.battery = null;
    this.wanted = false;      // keep reconnecting after a drop
    this.transfer = null;     // { records: [], timer }
    this.getNext = () => 0;   // set by the app: next index wanted for a log id
    // After this many failed reconnects, drop the device and start from a fresh
    // lookup, which clears a bad service list on Windows. Only worth it where
    // something calls choose() again without a click (the Windows app).
    this.freshLookupAfter = Infinity;
    this.attempt = 0;
    this.listening = new WeakSet();  // devices that already have a disconnect listener
    // Added once, so reconnecting doesn't stack up duplicate listeners.
    this.onLogDataEvent = (e) => this.onLogData(e.target.value);
    this.onStatusEvent = (e) => this.onStatus(e.target.value);
    this.onBatteryEvent = (e) => this.onBattery(e.target.value.getUint8(0));
  }

  setState(state) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('state', { detail: state }));
  }

  // Reconnects to a device this browser has used before, without a prompt.
  async reconnectKnown() {
    if (!navigator.bluetooth.getDevices) {
      console.info('Auto-reconnect is off: getDevices() is not available. See Settings > Device.');
      return false;
    }
    const devices = await navigator.bluetooth.getDevices();
    console.info(`Auto-reconnect: ${devices.length} remembered device(s)`, devices.map((d) => d.name));
    const device = devices.find((d) => d.name === 'VaperTaper');
    if (!device) return false;
    this.use(device);
    this.wanted = true;
    this.connectLoop();
    return true;
  }

  // Shows the browser's device picker. Must be called from a click.
  async choose() {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE] }, { name: 'VaperTaper' }],
      optionalServices: [SERVICE, 'battery_service'],
    });
    this.use(device);
    this.wanted = true;
    await this.connectLoop();
  }

  use(device) {
    this.device = device;
    if (this.listening.has(device)) return;
    this.listening.add(device);
    device.addEventListener('gattserverdisconnected', () => {
      if (this.device !== device) return;  // an old, dropped device
      this.transfer = null;
      this.setState('disconnected');
      if (this.wanted) setTimeout(() => this.connectLoop(), 2000);
    });
  }

  async disconnect() {
    this.wanted = false;
    if (this.device?.gatt.connected) this.device.gatt.disconnect();
  }

  async connectLoop() {
    if (this.looping) return;
    this.looping = true;
    let wait = 3000;
    let failures = 0;
    try {
      while (this.wanted && this.state !== 'connected') {
        const attempt = ++this.attempt;
        let timer;
        try {
          // A connect can hang for ever on Windows; give up after 30 s.
          await Promise.race([
            this.connectOnce(attempt),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timed out after 30 s')), 30000); }),
          ]);
        } catch (e) {
          this.attempt++;  // makes a late-finishing attempt stand down
          console.warn('Connect failed:', e.message);
          if (this.device.gatt.connected) this.device.gatt.disconnect();
          this.setState('disconnected');
          if (++failures >= this.freshLookupAfter) {
            console.warn('Starting again with a fresh device lookup');
            this.wanted = false;
            this.device = null;
            return;
          }
          await new Promise((r) => setTimeout(r, wait));
          wait = Math.min(wait * 2, 30000);
        } finally {
          clearTimeout(timer);
        }
      }
    } finally {
      this.looping = false;
    }
  }

  async connectOnce(attempt) {
    this.setState('connecting');
    // After a refresh, Chrome and Edge can only connect once they've heard the
    // device advertise, so wait for that (or give up waiting after 10 s).
    if (this.device.watchAdvertisements) {
      const stop = new AbortController();
      try {
        const heard = new Promise((resolve) => {
          this.device.addEventListener('advertisementreceived', resolve, { once: true });
          setTimeout(resolve, 10000);
        });
        await this.device.watchAdvertisements({ signal: stop.signal });
        await heard;
      } catch (e) {
        console.warn('Could not watch for adverts:', e.message);
      } finally {
        stop.abort();
      }
    }
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE);
    this.chars = {
      time: await svc.getCharacteristic(TIME),
      status: await svc.getCharacteristic(STATUS),
      logCtl: await svc.getCharacteristic(LOG_CTL),
      logData: await svc.getCharacteristic(LOG_DATA),
    };

    this.chars.logData.addEventListener('characteristicvaluechanged', this.onLogDataEvent);
    await this.chars.logData.startNotifications();
    this.chars.status.addEventListener('characteristicvaluechanged', this.onStatusEvent);
    await this.chars.status.startNotifications();

    try {
      const bas = await server.getPrimaryService('battery_service');
      const level = await bas.getCharacteristic('battery_level');
      level.addEventListener('characteristicvaluechanged', this.onBatteryEvent);
      await level.startNotifications();
      this.onBattery((await level.readValue()).getUint8(0));
    } catch (e) {
      console.warn('No battery level:', e.message);
    }

    await this.syncTime();
    if (attempt !== this.attempt) throw new Error('superseded by a newer attempt');
    this.setState('connected');
    this.onStatus(await this.chars.status.readValue());
  }

  async syncTime() {
    const buf = new DataView(new ArrayBuffer(4));
    buf.setUint32(0, Math.floor(Date.now() / 1000), true);
    await this.chars.time.writeValueWithResponse(buf);
  }

  onBattery(level) {
    this.battery = level;
    this.dispatchEvent(new CustomEvent('battery', { detail: level }));
  }

  onStatus(v) {
    this.status = {
      logId: v.getUint32(0, true),
      first: v.getUint32(4, true),
      total: v.getUint32(8, true),
      deviceTime: v.getUint32(12, true),
      battery: v.getUint8(16),
      timeSet: !!(v.getUint8(17) & 1),
      usbPower: !!(v.getUint8(17) & 2),
      batteryMv: v.getUint16(18, true),
    };
    this.dispatchEvent(new CustomEvent('status', { detail: this.status }));
    this.fetchIfBehind();
  }

  fetchIfBehind() {
    const s = this.status;
    if (!s || this.transfer || this.state !== 'connected') return;
    const next = this.getNext(s.logId);
    if (next >= s.total) {
      this.dispatchEvent(new CustomEvent('records', { detail: { logId: s.logId, records: [], total: s.total, done: true } }));
      return;
    }
    this.transfer = { records: [], timer: null };
    this.armTimeout();
    const buf = new DataView(new ArrayBuffer(4));
    buf.setUint32(0, next > s.total ? 0 : next, true);
    this.chars.logCtl.writeValueWithResponse(buf).catch(() => { this.transfer = null; });
  }

  armTimeout() {
    clearTimeout(this.transfer.timer);
    this.transfer.timer = setTimeout(() => {
      this.transfer = null;  // stalled; try again on the next status
      this.fetchIfBehind();
    }, 10000);
  }

  onLogData(v) {
    if (!this.transfer) return;
    this.armTimeout();
    for (let o = 0; o + 12 <= v.byteLength; o += 12) {
      const index = v.getUint32(o, true);
      if (index === END_MARKER) {
        const t = this.transfer;
        clearTimeout(t.timer);
        this.transfer = null;
        this.dispatchEvent(new CustomEvent('records', {
          detail: { logId: this.status.logId, records: t.records, total: v.getUint32(o + 4, true), done: true },
        }));
        this.fetchIfBehind();  // a puff may have arrived meanwhile
        return;
      }
      this.transfer.records.push({
        index,
        time: v.getUint32(o + 4, true),
        durationMs: v.getUint16(o + 8, true),
        flags: v.getUint16(o + 10, true),
      });
    }
  }
}
