// FSR press test for the Vape Logger.
//
// Reads the force-sensitive resistor on D1/A1 and prints the raw value over
// USB serial, so you can see how hard a press needs to be to register.
// The red LED lights while the FSR is pressed.
//
// Wiring (see docs/build-journal.md, section 6):
//   3V3 -- FSR -- D1 -- 100k -- GND
//
// Board: Seeed nRF52 Boards > Seeed XIAO nRF52840
// Open Tools > Serial Monitor (115200 baud) or Tools > Serial Plotter.

// Serial comes from the TinyUSB library on this core. Without this include the
// IDE can fail to link it ("undefined reference to `Serial'").
#include <Adafruit_TinyUSB.h>

const int FSR_PIN = A1;          // same physical pin as D1
const int PRESS_THRESHOLD = 500; // 0-1023; tune this from the readings

bool wasPressed = false;
unsigned long pressStart = 0;

void setup() {
  Serial.begin(115200);
  pinMode(LED_RED, OUTPUT);
  digitalWrite(LED_RED, HIGH);   // the XIAO's LEDs are on when LOW
}

void loop() {
  int value = analogRead(FSR_PIN);
  bool pressed = value > PRESS_THRESHOLD;

  digitalWrite(LED_RED, pressed ? LOW : HIGH);

  if (pressed && !wasPressed) {
    pressStart = millis();
  } else if (!pressed && wasPressed) {
    Serial.print("Press lasted ");
    Serial.print(millis() - pressStart);
    Serial.println(" ms");
  }
  wasPressed = pressed;

  Serial.print("fsr:");
  Serial.println(value);
  delay(50);
}
