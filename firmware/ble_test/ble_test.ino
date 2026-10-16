// Bluetooth test for the Vape Logger. Needs no wiring: just the XIAO on USB.
//
// The board advertises as "VapeLogger" with the Nordic UART service, the
// standard "serial port over Bluetooth". Once a phone connects, it sends a
// line every second, and answers "ping" with "pong".
//
// Phone app: "Bluefruit Connect" (Adafruit) > connect to VapeLogger > UART,
// or "nRF Connect" > Nordic UART Service > turn on notifications for TX.
//
// Board: Seeed nRF52 Boards > Seeed XIAO nRF52840
// LEDs: blue blinks while advertising and stays on once connected (handled by
// the Bluefruit library); green flashes when the phone sends something.

#include <bluefruit.h>

BLEUart bleuart;
unsigned long lastSend = 0;
unsigned long connectedAt = 0;

void connectCallback(uint16_t connHandle) {
  (void)connHandle;
  connectedAt = millis();
  Serial.println("Phone connected");
}

void disconnectCallback(uint16_t connHandle, uint8_t reason) {
  (void)connHandle;
  Serial.print("Phone disconnected, reason 0x");
  Serial.println(reason, HEX);
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_GREEN, OUTPUT);
  digitalWrite(LED_GREEN, HIGH);  // the XIAO's LEDs are on when LOW

  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("VapeLogger");
  Bluefruit.Periph.setConnectCallback(connectCallback);
  Bluefruit.Periph.setDisconnectCallback(disconnectCallback);

  bleuart.begin();

  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();
  Bluefruit.Advertising.addService(bleuart);
  Bluefruit.ScanResponse.addName();
  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);  // in units of 0.625 ms
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);              // advertise forever

  Serial.println("Advertising as VapeLogger");
}

void loop() {
  if (Bluefruit.connected() && millis() - lastSend >= 1000) {
    lastSend = millis();
    bleuart.print("Connected for ");
    bleuart.print((millis() - connectedAt) / 1000);
    bleuart.println(" s");
  }

  if (bleuart.available()) {
    String msg = bleuart.readString();
    msg.trim();
    Serial.print("Phone sent: ");
    Serial.println(msg);

    digitalWrite(LED_GREEN, LOW);
    delay(150);
    digitalWrite(LED_GREEN, HIGH);

    if (msg.equalsIgnoreCase("ping")) {
      bleuart.println("pong");
    } else {
      bleuart.print("You sent: ");
      bleuart.println(msg);
    }
  }
}
