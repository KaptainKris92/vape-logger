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
  }

  setState(state) {
    this.state = state;
    this.dispatchEvent(new CustomEvent('state', { detail: state }));
  }

  // Reconnects to a device this browser has used before, without a prompt.
  async reconnectKnown() {
    if (!navigator.bluetooth.getDevices) return false;
    const devices = await navigator.bluetooth.getDevices();
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
    if (this.device === device) return;
    this.device = device;
    device.addEventListener('gattserverdisconnected', () => {
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
    try {
      while (this.wanted && this.state !== 'connected') {
        try {
          await this.connectOnce();
        } catch (e) {
          console.warn('Connect failed:', e.message);
          if (this.device.gatt.connected) this.device.gatt.disconnect();
          this.setState('disconnected');
          await new Promise((r) => setTimeout(r, wait));
          wait = Math.min(wait * 2, 30000);
        }
      }
    } finally {
      this.looping = false;
    }
  }

  async connectOnce() {
    this.setState('connecting');
    // Some browsers can only connect once they've heard the device advertise.
    if (this.device.watchAdvertisements && !this.device.watchingAdvertisements) {
      try { await this.device.watchAdvertisements(); } catch { /* not needed everywhere */ }
    }
    const server = await this.device.gatt.connect();
    const svc = await server.getPrimaryService(SERVICE);
    this.chars = {
      time: await svc.getCharacteristic(TIME),
      status: await svc.getCharacteristic(STATUS),
      logCtl: await svc.getCharacteristic(LOG_CTL),
      logData: await svc.getCharacteristic(LOG_DATA),
    };

    this.chars.logData.addEventListener('characteristicvaluechanged', (e) => this.onLogData(e.target.value));
    await this.chars.logData.startNotifications();
    this.chars.status.addEventListener('characteristicvaluechanged', (e) => this.onStatus(e.target.value));
    await this.chars.status.startNotifications();

    try {
      const bas = await server.getPrimaryService('battery_service');
      const level = await bas.getCharacteristic('battery_level');
      level.addEventListener('characteristicvaluechanged', (e) => this.onBattery(e.target.value.getUint8(0)));
      await level.startNotifications();
      this.onBattery((await level.readValue()).getUint8(0));
    } catch (e) {
      console.warn('No battery level:', e.message);
    }

    await this.syncTime();
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
