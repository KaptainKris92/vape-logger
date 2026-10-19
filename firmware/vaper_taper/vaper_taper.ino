// Vaper Taper: the main firmware.
//
// Logs every press of the FSR on the vape's fire button with a timestamp and
// duration, keeps the log in flash, and serves it over Bluetooth LE to the
// Vaper Taper app (app/ in this repo) on a PC or a phone.
//
// Wiring (see docs/how-it-works.md):
//   3V3 -- FSR -- D1 -- 100k -- GND
//
// Board: Seeed nRF52 Boards > Seeed XIAO nRF52840
// Serial Monitor (115200 baud) shows what it is doing while on USB.
//
// How time works: the board has no clock that survives a power loss, so the
// app writes the current time each time it connects. Until that happens after
// a reset, puffs are held in RAM and saved once the time is known.
//
// The chip stays in System ON sleep between checks of the FSR (every 50 ms)
// rather than System OFF, because System OFF stops the clock and the radio.
//
// Bluetooth service (UUIDs 9d1eXXXX-5f6a-4c3b-8e2d-7a6b5c4d3e2f):
//   0002 Time     write  uint32 Unix time (seconds, UTC)
//   0003 Status   read, notify  20 bytes, see updateStatus()
//   0004 Log ctl  write  uint32 first index wanted; the log is then sent on 0005
//   0005 Log data notify  12-byte records: uint32 index, uint32 time,
//                         uint16 duration ms, uint16 flags. A record with
//                         index 0xFFFFFFFF marks the end of a transfer.
// Plus the standard Battery Service (0x180F).

#include <bluefruit.h>
#include <Adafruit_LittleFS.h>
#include <InternalFileSystem.h>

using namespace Adafruit_LittleFS_Namespace;

// ---- Settings ----
const int FSR_PIN = D1;
const uint32_t POLL_MS = 50;           // how often the FSR is checked
const uint32_t MIN_PRESS_MS = 250;     // shorter presses are ignored as knocks
const uint32_t RELEASE_MS = 150;       // the FSR must be off this long to end a press
const bool BLINK_ON_PUFF = true;       // short green flash when a puff is saved
const uint32_t BATTERY_EVERY_MS = 60000;
const uint8_t MAX_CONNECTIONS = 2;     // a PC and a phone can be connected at once

// ---- Log storage ----
// Records are appended to chunk files /vt/c<n>, 128 records (1 KB) each.
// Only the newest MAX_CHUNKS are kept, so the oldest records drop off.
const char *LOG_DIR = "/vt";
const char *LOG_ID_FILE = "/vt/id";
const uint32_t CHUNK_RECORDS = 128;
const uint32_t MAX_CHUNKS = 16;        // 2048 puffs
const uint16_t FLAG_NO_TIME = 0x0001;  // time is seconds since an unknown reset

struct __attribute__((packed)) Puff {
  uint32_t time;       // Unix seconds (UTC)
  uint16_t durationMs;
  uint16_t flags;
};

uint32_t logId = 0;      // random, changes if the log is wiped, so the app can tell
uint32_t firstIndex = 0; // index of the oldest record still stored
uint32_t totalCount = 0; // index the next record will get

// ---- Bluetooth ----
#define VT_UUID(n) { 0x2f, 0x3e, 0x4d, 0x5c, 0x6b, 0x7a, 0x2d, 0x8e, \
                     0x3b, 0x4c, 0x6a, 0x5f, (n), 0x00, 0x1e, 0x9d }
const uint8_t UUID_SERVICE[] = VT_UUID(0x01);
const uint8_t UUID_TIME[]    = VT_UUID(0x02);
const uint8_t UUID_STATUS[]  = VT_UUID(0x03);
const uint8_t UUID_LOG_CTL[] = VT_UUID(0x04);
const uint8_t UUID_LOG_DATA[] = VT_UUID(0x05);

BLEService vtService(UUID_SERVICE);
BLECharacteristic timeChar(UUID_TIME);
BLECharacteristic statusChar(UUID_STATUS);
BLECharacteristic logCtlChar(UUID_LOG_CTL);
BLECharacteristic logDataChar(UUID_LOG_DATA);
BLEBas blebas;

// Set by Bluetooth callbacks, acted on in loop(), so that all the flash and
// clock work happens in one place.
volatile bool timeReceived = false;
volatile uint32_t receivedUnix = 0;

struct Transfer {
  volatile bool requested;
  volatile uint32_t requestFrom;
  bool active;
  uint32_t next;
};
Transfer transfers[MAX_CONNECTIONS];
uint32_t connectedAt[MAX_CONNECTIONS];
bool slowParamsSent[MAX_CONNECTIONS];

// ---- Clock ----
uint64_t totalTicks = 0;
uint32_t lastTicks = 0;
uint64_t uptimeMsValue = 0;
bool timeSynced = false;
int64_t unixAtBoot = 0;  // Unix seconds when uptime was 0

// millis() on this core jumps back to 0 after about 48 days, so count the
// FreeRTOS ticks (1024 per second) ourselves. Called every loop.
uint64_t uptimeMs() {
  uint32_t ticks = xTaskGetTickCount();
  totalTicks += (uint32_t)(ticks - lastTicks);
  lastTicks = ticks;
  uptimeMsValue = totalTicks * 1000 / configTICK_RATE_HZ;
  return uptimeMsValue;
}

uint32_t unixNow() {
  return timeSynced ? (uint32_t)(unixAtBoot + (int64_t)(uptimeMsValue / 1000)) : 0;
}

// Puffs from before the first time sync, as seconds since reset.
Puff pending[64];
uint8_t pendingCount = 0;

// ---- Battery ----
uint8_t batteryPercent = 0;
uint16_t batteryMv = 0;
uint64_t lastBatteryMs = 0;

// ---- FSR ----
bool pressing = false;
uint64_t pressStartMs = 0;
uint64_t lastHighMs = 0;

// ======================= Log storage =======================

void chunkPath(uint32_t chunk, char *out) {
  sprintf(out, "%s/c%lu", LOG_DIR, (unsigned long)chunk);
}

uint32_t randomId() {
  uint32_t id = 0;
  while (sd_rand_application_vector_get((uint8_t *)&id, sizeof(id)) != NRF_SUCCESS) delay(1);
  return id ? id : 1;
}

void setupStorage() {
  InternalFS.begin();
  if (!InternalFS.exists(LOG_DIR)) InternalFS.mkdir(LOG_DIR);

  File idFile(InternalFS);
  if (idFile.open(LOG_ID_FILE, FILE_O_READ)) {
    idFile.read(&logId, sizeof(logId));
    idFile.close();
  }
  if (logId == 0) {
    logId = randomId();
    if (idFile.open(LOG_ID_FILE, FILE_O_WRITE)) {
      idFile.seek(0);
      idFile.write((uint8_t *)&logId, sizeof(logId));
      idFile.close();
    }
  }

  // Find the oldest and newest chunk files.
  bool any = false;
  uint32_t minChunk = 0, maxChunk = 0;
  File dir = InternalFS.open(LOG_DIR);
  File entry = dir.openNextFile();
  while (entry) {
    const char *name = entry.name();
    if (name[0] == 'c' && !entry.isDirectory()) {
      uint32_t n = strtoul(name + 1, NULL, 10);
      if (!any || n < minChunk) minChunk = n;
      if (!any || n > maxChunk) maxChunk = n;
      any = true;
    }
    entry.close();
    entry = dir.openNextFile();
  }
  dir.close();

  if (any) {
    char path[24];
    chunkPath(maxChunk, path);
    File f(InternalFS);
    uint32_t records = 0;
    if (f.open(path, FILE_O_READ)) {
      records = f.size() / sizeof(Puff);  // ignores a half-written record
      f.close();
    }
    firstIndex = minChunk * CHUNK_RECORDS;
    totalCount = maxChunk * CHUNK_RECORDS + records;
  }
  Serial.printf("Log %08lx: records %lu to %lu\n", (unsigned long)logId,
                (unsigned long)firstIndex, (unsigned long)totalCount);
}

void appendPuff(const Puff &p) {
  char path[24];
  uint32_t chunk = totalCount / CHUNK_RECORDS;
  chunkPath(chunk, path);
  File f(InternalFS);
  if (!f.open(path, FILE_O_WRITE)) {
    Serial.println("Could not open the log file");
    return;
  }
  f.seek((totalCount % CHUNK_RECORDS) * sizeof(Puff));
  f.write((const uint8_t *)&p, sizeof(Puff));
  f.close();
  totalCount++;

  // Drop the oldest chunk once there are too many.
  while (chunk - firstIndex / CHUNK_RECORDS >= MAX_CHUNKS) {
    chunkPath(firstIndex / CHUNK_RECORDS, path);
    InternalFS.remove(path);
    firstIndex += CHUNK_RECORDS;
  }
}

bool readPuff(uint32_t index, Puff &p) {
  char path[24];
  chunkPath(index / CHUNK_RECORDS, path);
  File f(InternalFS);
  if (!f.open(path, FILE_O_READ)) return false;
  f.seek((index % CHUNK_RECORDS) * sizeof(Puff));
  bool ok = f.read(&p, sizeof(Puff)) == sizeof(Puff);
  f.close();
  return ok;
}

// ======================= Battery =======================

// Resting LiPo voltage (mV) to percentage, interpolated between points.
const uint16_t BATTERY_CURVE[][2] = {
  {4200, 100}, {4110, 90}, {4020, 80}, {3950, 70}, {3870, 60}, {3840, 50},
  {3800, 40}, {3770, 30}, {3730, 20}, {3690, 10}, {3610, 5}, {3300, 0},
};

uint8_t percentFromMv(uint16_t mv) {
  const int n = sizeof(BATTERY_CURVE) / sizeof(BATTERY_CURVE[0]);
  if (mv >= BATTERY_CURVE[0][0]) return 100;
  for (int i = 1; i < n; i++) {
    if (mv >= BATTERY_CURVE[i][0]) {
      uint16_t hiMv = BATTERY_CURVE[i - 1][0], loMv = BATTERY_CURVE[i][0];
      uint16_t hiPc = BATTERY_CURVE[i - 1][1], loPc = BATTERY_CURVE[i][1];
      return loPc + (uint32_t)(mv - loMv) * (hiPc - loPc) / (hiMv - loMv);
    }
  }
  return 0;
}

bool usbPowered() {
  uint32_t status = 0;
  sd_power_usbregstatus_get(&status);
  return status & POWER_USBREGSTATUS_VBUSDETECT_Msk;
}

void readBattery() {
  // VBAT_ENABLE is held LOW from setup(); the divider is 1 M over 510 k.
  uint32_t sum = 0;
  for (int i = 0; i < 8; i++) sum += analogRead(PIN_VBAT);
  float adcMv = (sum / 8.0f) * 3600.0f / 4096.0f;  // 12-bit, 3.6 V reference
  batteryMv = (uint16_t)(adcMv * 1510.0f / 510.0f);
  batteryPercent = percentFromMv(batteryMv);
  blebas.write(batteryPercent);
  for (uint16_t c = 0; c < MAX_CONNECTIONS; c++) {
    if (Bluefruit.connected(c)) blebas.notify(c, batteryPercent);  // skipped if not subscribed
  }
}

// ======================= Bluetooth =======================

// Status: uint32 log id, uint32 first index, uint32 total count,
// uint32 device time (0 until synced), uint8 battery %, uint8 flags
// (bit 0 time synced, bit 1 on USB power), uint16 battery mV.
void updateStatus() {
  uint8_t buf[20];
  uint32_t now = unixNow();
  memcpy(buf + 0, &logId, 4);
  memcpy(buf + 4, &firstIndex, 4);
  memcpy(buf + 8, &totalCount, 4);
  memcpy(buf + 12, &now, 4);
  buf[16] = batteryPercent;
  buf[17] = (timeSynced ? 1 : 0) | (usbPowered() ? 2 : 0);
  memcpy(buf + 18, &batteryMv, 2);
  statusChar.write(buf, sizeof(buf));
  for (uint16_t c = 0; c < MAX_CONNECTIONS; c++) {
    if (Bluefruit.connected(c) && statusChar.notifyEnabled(c)) statusChar.notify(c, buf, sizeof(buf));
  }
}

void onTimeWrite(uint16_t conn, BLECharacteristic *chr, uint8_t *data, uint16_t len) {
  (void)conn; (void)chr;
  if (len < 4) return;
  memcpy((void *)&receivedUnix, data, 4);
  timeReceived = true;
}

void onLogCtlWrite(uint16_t conn, BLECharacteristic *chr, uint8_t *data, uint16_t len) {
  (void)chr;
  if (len < 4 || conn >= MAX_CONNECTIONS) return;
  uint32_t from;
  memcpy(&from, data, 4);
  transfers[conn].requestFrom = from;
  transfers[conn].requested = true;
}

void onConnect(uint16_t conn) {
  Serial.printf("Connected (%u)\n", conn);
  if (conn < MAX_CONNECTIONS) {
    transfers[conn].requested = false;
    transfers[conn].active = false;
    connectedAt[conn] = millis();
    slowParamsSent[conn] = false;
  }
  // Keep advertising so a second device (PC or phone) can still connect.
  if (Bluefruit.connected() < MAX_CONNECTIONS) Bluefruit.Advertising.start(0);
}

void onDisconnect(uint16_t conn, uint8_t reason) {
  Serial.printf("Disconnected (%u), reason 0x%02x\n", conn, reason);
  if (conn < MAX_CONNECTIONS) {
    transfers[conn].requested = false;
    transfers[conn].active = false;
  }
}

void setupBluetooth() {
  Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);  // bigger packets for log download
  Bluefruit.begin(MAX_CONNECTIONS, 0);
  Bluefruit.autoConnLed(false);  // a blinking blue LED would drain the battery
  Bluefruit.setTxPower(4);
  Bluefruit.setName("VaperTaper");
  Bluefruit.Periph.setConnectCallback(onConnect);
  Bluefruit.Periph.setDisconnectCallback(onDisconnect);

  blebas.begin();

  vtService.begin();

  timeChar.setProperties(CHR_PROPS_WRITE);
  timeChar.setPermission(SECMODE_NO_ACCESS, SECMODE_OPEN);
  timeChar.setFixedLen(4);
  timeChar.setWriteCallback(onTimeWrite);
  timeChar.begin();

  statusChar.setProperties(CHR_PROPS_READ | CHR_PROPS_NOTIFY);
  statusChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  statusChar.setFixedLen(20);
  statusChar.begin();

  logCtlChar.setProperties(CHR_PROPS_WRITE);
  logCtlChar.setPermission(SECMODE_NO_ACCESS, SECMODE_OPEN);
  logCtlChar.setFixedLen(4);
  logCtlChar.setWriteCallback(onLogCtlWrite);
  logCtlChar.begin();

  logDataChar.setProperties(CHR_PROPS_NOTIFY);
  logDataChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  logDataChar.setMaxLen(240);
  logDataChar.begin();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addService(vtService);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  // Fast (20 ms) for 30 s after starting, then about once a second to save power.
  Bluefruit.Advertising.setInterval(32, 1636);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

// Sends a few packets of a log transfer per loop, so presses are still
// checked while a long log is downloading.
void serviceTransfers() {
  for (uint16_t c = 0; c < MAX_CONNECTIONS; c++) {
    Transfer &t = transfers[c];
    if (t.requested) {
      t.requested = false;
      t.active = true;
      t.next = t.requestFrom > firstIndex ? (uint32_t)t.requestFrom : firstIndex;
    }
    if (!t.active) continue;
    if (!Bluefruit.connected(c) || !logDataChar.notifyEnabled(c)) {
      t.active = false;
      continue;
    }

    uint16_t mtu = Bluefruit.Connection(c)->getMtu();
    uint8_t perPacket = min((mtu - 3) / 12, 240 / 12);
    uint8_t buf[240];

    for (int packet = 0; packet < 4 && t.active; packet++) {
      uint8_t n = 0;
      while (n < perPacket && t.next < totalCount) {
        Puff p;
        if (t.next < firstIndex) t.next = firstIndex;  // dropped while sending
        if (!readPuff(t.next, p)) { t.next++; continue; }
        uint8_t *r = buf + n * 12;
        memcpy(r, &t.next, 4);
        memcpy(r + 4, &p.time, 4);
        memcpy(r + 8, &p.durationMs, 2);
        memcpy(r + 10, &p.flags, 2);
        n++;
        t.next++;
      }
      if (n < perPacket) {
        // Everything is sent: add the end marker, with the total count.
        uint8_t *r = buf + n * 12;
        uint32_t marker = 0xFFFFFFFF;
        memset(r, 0, 12);
        memcpy(r, &marker, 4);
        memcpy(r + 4, &totalCount, 4);
        n++;
        t.active = false;
      }
      if (!logDataChar.notify(c, buf, n * 12)) {
        t.active = false;  // the link dropped or stalled; the app will ask again
      }
    }
  }
}

// Once a connection has settled, ask for a slower connection to save power.
// The PC or phone may say no, which is fine.
void slowDownIdleConnections() {
  for (uint16_t c = 0; c < MAX_CONNECTIONS; c++) {
    if (!Bluefruit.connected(c) || slowParamsSent[c] || transfers[c].active) continue;
    if (millis() - connectedAt[c] < 15000) continue;
    slowParamsSent[c] = true;
    // 150 ms interval (units of 1.25 ms), skip up to 4 events, 4 s timeout.
    Bluefruit.Connection(c)->requestConnectionParameter(120, 4, 400);
  }
}

// ======================= Puffs =======================

void blink() {
  if (!BLINK_ON_PUFF) return;
  digitalWrite(LED_GREEN, LOW);
  delay(30);
  digitalWrite(LED_GREEN, HIGH);
}

void recordPuff(uint64_t startMs, uint32_t durationMs) {
  Puff p;
  p.durationMs = durationMs > 65535 ? 65535 : durationMs;
  p.flags = 0;
  if (timeSynced) {
    p.time = (uint32_t)(unixAtBoot + (int64_t)(startMs / 1000));
    appendPuff(p);
  } else if (pendingCount < sizeof(pending) / sizeof(pending[0])) {
    p.time = startMs / 1000;  // seconds since reset, fixed up when the time arrives
    pending[pendingCount++] = p;
  } else {
    p.time = startMs / 1000;
    p.flags = FLAG_NO_TIME;
    appendPuff(p);
  }
  Serial.printf("Puff: %lu ms%s\n", (unsigned long)p.durationMs, timeSynced ? "" : " (time not set yet)");
  blink();
  updateStatus();
}

void checkFsr(uint64_t now) {
  bool high = digitalRead(FSR_PIN) == HIGH;
  if (high) {
    if (!pressing) {
      pressing = true;
      pressStartMs = now;
    }
    lastHighMs = now;
  } else if (pressing && now - lastHighMs >= RELEASE_MS) {
    pressing = false;
    uint32_t duration = lastHighMs - pressStartMs + POLL_MS;
    if (duration >= MIN_PRESS_MS) recordPuff(pressStartMs, duration);
  }
}

void applyTimeSync(uint64_t now) {
  if (!timeReceived) return;
  timeReceived = false;
  unixAtBoot = (int64_t)receivedUnix - (int64_t)(now / 1000);
  bool first = !timeSynced;
  timeSynced = true;
  if (first) {
    Serial.printf("Time set, saving %u waiting puffs\n", pendingCount);
    for (uint8_t i = 0; i < pendingCount; i++) {
      pending[i].time = (uint32_t)(unixAtBoot + pending[i].time);
      appendPuff(pending[i]);
    }
    pendingCount = 0;
  }
  updateStatus();
}

// ======================= Main =======================

void setup() {
  Serial.begin(115200);

  pinMode(FSR_PIN, INPUT);  // the 100k resistor is the pull-down
  pinMode(LED_RED, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_BLUE, OUTPUT);
  digitalWrite(LED_RED, HIGH);  // the XIAO's LEDs are on when LOW
  digitalWrite(LED_GREEN, HIGH);
  digitalWrite(LED_BLUE, HIGH);

  // Seeed: keep P0.14 LOW, especially while charging.
  pinMode(VBAT_ENABLE, OUTPUT);
  digitalWrite(VBAT_ENABLE, LOW);
  analogReference(AR_INTERNAL);  // 3.6 V
  analogReadResolution(12);

  lastTicks = xTaskGetTickCount();
  setupBluetooth();  // before storage: the log id uses the radio's random numbers
  setupStorage();
  readBattery();
  updateStatus();
  Serial.println("Vaper Taper ready, advertising as VaperTaper");
}

void loop() {
  uint64_t now = uptimeMs();

  checkFsr(now);
  applyTimeSync(now);
  serviceTransfers();
  slowDownIdleConnections();

  if (now - lastBatteryMs >= BATTERY_EVERY_MS) {
    lastBatteryMs = now;
    readBattery();
    updateStatus();
  }

  // delay() lets the chip sleep until the next check.
  delay(POLL_MS);
}
