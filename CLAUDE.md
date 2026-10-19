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
- **Firmware:** `firmware/vaper_taper/`. It polls D1 every 50 ms in System ON sleep, not System OFF, because System OFF stops the clock and the radio. Puffs go into chunk files in InternalFS (last 2048 kept). A custom BLE service handles time sync and log download, plus the standard Battery Service (`BLEBas`). The protocol is documented at the top of the sketch, and `app/js/ble.js` must match it.
- **Time:** the app writes Unix time on every connect. Puffs before the first sync after a reset wait in RAM, then get saved with the right time.
- **Two connections:** the device accepts a PC and a phone at once. Each downloads the full log from its own saved index, keyed by a random log id that changes if the flash is wiped.
- **App:** one installable web app (PWA) in `app/` for Chrome/Edge on Windows and Chrome on Android, published to GitHub Pages by `.github/workflows/pages.yml`. Plain HTML/JS, no build step. Data stays in each browser's localStorage. It shows battery % with a low-battery warning at 20%.
- **Windows app:** `desktop/` wraps `app/` in Electron (pinned versions) for a tray app that starts with Windows. It serves `app/` on a private `vapertaper://` scheme, auto-selects the device in `select-bluetooth-device`, and calls `window.vaperTaperAutoConnect()` with a simulated user gesture every 30 s. Keep `app/` working in both the browser and Electron. Build with `npm run dist` in `desktop/`.
- **Night rules:** nights default to 01:00 to 08:00 and can be changed per night. Night time doesn't count towards streaks, XP or achievements, night puffs are counted separately, and every puff (night included) restarts the streak.
- **Surprises:** the owner doesn't want to see buddy evolutions, later shop items or locked achievements. Never describe them in chat, docs or commit messages. They live only in `app/js/companion.js` (marked as spoilers) and `app/js/stats.js`.

## Repo conventions

- Each sketch lives in its own folder under `firmware/` with a matching `.ino` name.
- Record progress as a dated entry in `docs/build-journal.md` (section 10), tick milestones in section 8, and add hard-won tips to "Lessons learned".
- Writing style in docs: plain British English, short sentences, no em-dashes.
- There is no CI for firmware. The Seeed core is installed on the owner's PC, so a sketch can be compile-checked with a downloaded `arduino-cli` and `--config-file ~/.arduinoIDE/arduino-cli.yaml --fqbn Seeeduino:nrf52:xiaonRF52840`, from a copy in a path with no spaces. Behaviour is still verified by the owner on the device.
- App logic tests: `node --test app/tests/stats.test.mjs`.
