# Vaper Taper (vape-logger)

A clip-on puff logger for a Geekvape Aegis Legend 5. The app and device are called **Vaper Taper** (tagline: "Taper the vaper"). The repo is still named `vape-logger`.

The background, plan and milestones are in `docs/build-journal.md`. The circuit and pins are in `docs/how-it-works.md`. Read both before changing firmware or wiring assumptions.

## Who this is for

The owner is new to hardware. They use **Windows** and the **Arduino IDE 2** (not `arduino-cli`). They upload sketches themselves, so every firmware change needs plain step-by-step instructions to test it: which sketch to open, which menu, and what they should see.

## Hardware (built and tested 2026-10-18)

- **Board:** Seeed XIAO nRF52840 (not the Sense).
- **Board package:** **Seeed nRF52 Boards** (the non-mbed core, Adafruit-based), board "Seeed XIAO nRF52840". Use the Bluefruit library for BLE, not ArduinoBLE.
- **FSR circuit:** `3V3 ── FSR ── D1 ── 100 kΩ ── GND`. D1/A1 reads **0–3 untouched and ~1000 pressed** (`analogRead`, 10-bit). A press is a clean digital HIGH on D1, so D1 can wake the chip from System OFF (sense HIGH).
- **Battery:** 150 mAh LiPo on the BAT+/BAT− pads, charged by the onboard charger over USB-C.
- **LEDs** (`LED_RED`, `LED_GREEN`, `LED_BLUE`) are active LOW.
- **Battery voltage:** read the onboard divider on `P0.31` (`PIN_VBAT`), enabled by driving `P0.14` (`VBAT_ENABLE`) LOW. Seeed warns to keep P0.14 LOW while charging, so don't drive it HIGH as an "off" state.

## Firmware gotchas (all hit in practice)

- Any sketch that uses `Serial` without including Bluefruit must start with `#include <Adafruit_TinyUSB.h>`, or linking fails with "undefined reference to `Serial`".
- The Seeed toolchain breaks on sketch paths that contain spaces.
- If the board's port disappears in the IDE, try **Tools > Reload board data**, then a quick double-tap of the RST button (which enters the bootloader and shows a USB drive).

## Decisions so far

- **BLE advertised name:** `VaperTaper`. `firmware/ble_test` still uses the old name "VapeLogger".
- **Firmware plan:** deep sleep with wake on press, a ring buffer of timestamped puffs in flash, a custom BLE service for time sync and log download, and the standard Battery Service (`BLEBas`) for battery %.
- **App plan:** plain HTML/JS Web Bluetooth page in `app/`, for Chrome on Android, hosted on GitHub Pages. It shows battery % with a low-battery warning (~20%). Data stays on the phone.

## Repo conventions

- Each sketch lives in its own folder under `firmware/` with a matching `.ino` name.
- Record progress as a dated entry in `docs/build-journal.md` (section 10), tick milestones in section 8, and add hard-won tips to "Lessons learned".
- Writing style in docs: plain British English, short sentences, no em-dashes.
- There is no CI; firmware can't be compiled here without the Seeed core, so changes are verified by the owner on the device.
