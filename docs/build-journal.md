# Vape Logger: Build Journal

A record of building a small clip-on device that automatically logs every puff from my vape, plus a phone app to see the data. It covers the background, the decisions, the parts and what happened at each step, including the mistakes.

**Status:** 🟢 Parts arrived. The board is programmed and blinking.

---

## Contents

1. [Background](#1-background)
2. [Goals](#2-goals)
3. [How it works](#3-how-it-works)
4. [Choosing an approach](#4-choosing-an-approach)
5. [Components](#5-components)
6. [Wiring](#6-wiring)
7. [Software plan](#7-software-plan)
8. [Milestones](#8-milestones)
9. [Safety notes](#9-safety-notes)
10. [Journal](#10-journal)
11. [Lessons learned](#11-lessons-learned)
12. [Ideas for later](#12-ideas-for-later)

---

## 1. Background

I'm trying to reduce how much I vape. The hard part is that vaping has become a largely **subconscious habit**: I often pick it up and take a puff without really noticing. It's difficult to cut down on something you don't notice yourself doing.

My vape, a **Geekvape Aegis Legend 5**, has a built-in puff counter on its screen, but it isn't enough:

- It isn't **automatic** in any useful sense. I have to remember to look at it, write the number down and reset it.
- It isn't **customisable**. There's no history, no time of day, no puff length, no trends and no goals.
- The data stays on the device. I can't analyse it or see it anywhere else.

So the plan is to build my own logger that records every puff automatically, with a timestamp and duration, and sends it to my phone. There I can see patterns (when, how often, how long) and set reduction goals.

It's also a good excuse to learn **hardware engineering**: sensors, microcontrollers, soldering, low-power firmware, Bluetooth and building an app.

## 2. Goals

**Must have**
- Log every puff automatically: the time it started and how long it lasted.
- Work without me doing anything differently when I vape.
- Send the log to my Android phone over Bluetooth.
- Last weeks on a charge, and recharge over USB-C.
- Not modify the inside of the vape (it's water- and shock-resistant, and I want to keep it that way).

**Nice to have**
- Daily, weekly and monthly charts, and a time-of-day heatmap.
- Reduction goals, such as a daily puff budget or a minimum gap between puffs.
- CSV export so I can do my own analysis.

**Not goals (for now)**
- Measuring liquid or nicotine directly.
- Any internal modification of the vape.

## 3. How it works

```
 ┌──────────────┐  press   ┌────────────────────┐  Bluetooth LE  ┌──────────────────┐
 │  Fire button │ ───────▶ │  XIAO nRF52840     │ ─────────────▶ │  Android phone   │
 │  + FSR on it │          │  wakes, timestamps │                │  Web Bluetooth   │
 └──────────────┘          │  logs to flash,    │ ◀───────────── │  app (Chrome)    │
                           │  sleeps again      │   time sync    │  charts, goals,  │
                           └────────────────────┘                │  CSV export      │
                                    ▲                            └──────────────────┘
                                    │ 150 mAh LiPo (USB-C charging)
```

1. A thin **force-sensitive resistor (FSR)** sits on top of the vape's fire button. I press through it as normal.
2. The press wakes the **XIAO nRF52840** microcontroller from deep sleep. It records when the press started and how long it lasted, saves that to flash memory, then goes back to sleep.
3. When my phone is nearby, the **app** connects over Bluetooth, sends the current time (the board has no real clock of its own) and downloads any new puffs.
4. The app stores the history on the phone and shows stats and charts.

## 4. Choosing an approach

These are the options I considered, from least to most invasive:

| | Approach | Opens the vape? | Verdict |
|---|---|---|---|
| **A** | Clip-on module that senses the fire-button press | No | ✅ **Chosen**: non-invasive, good first project |
| B | Drip-tip adapter with a pressure sensor that detects the draw | No | Possible later, but must be food-safe |
| C | Solder a wire to the fire button inside the mod | Yes | Cleanest data, but voids warranty and water resistance, and carries lithium battery risk |
| D | Sense current flowing to the coil | Yes | Not worth it: very high currents (30 A+) |

## 5. Components

Prices are approximate, taken at the time of ordering, and may change.

### Ordered

| Part | Qty | Approx. price | Purpose | Link |
|---|---|---|---|---|
| Seeed XIAO nRF52840 (plain, **loose headers**) | 1 | £9.50–10.80 | The brain: Bluetooth LE, deep sleep, built-in LiPo charger | [The Pi Hut](https://thepihut.com/products/seeed-xiao-ble-nrf52840) |
| 150 mAh 3.7 V LiPo, JST-PH connector | 1 | £4.50 | Power. Tiny: about 28 × 20 × 4 mm | [The Pi Hut](https://thepihut.com/products/150mah-3-7v-lipo-battery) |
| JST-PH battery extension cable, 500 mm | 1 | £1.70 | Cut in half: the socket end is soldered to the XIAO's battery pads so the battery plugs in | [The Pi Hut](https://thepihut.com/products/adafruit-jst-ph-battery-extension-cable-500mm) |
| Round force-sensitive resistor (Adafruit 166) | 1 | £3.80 + VAT | Senses the fire-button press | [The Pi Hut](https://thepihut.com/collections/force-weight-sensors/products/round-force-sensitive-resistor-fsr) |
| 100 kΩ resistors, pack of 25 | 1 | £0.80 | Pull-down resistor for the FSR | [The Pi Hut](https://thepihut.com/products/through-hole-resistors-100k-ohm-5-1-4w-pack-of-25) |
| 265-piece heat-shrink kit | 1 | £6 + VAT | Insulating joints and wrapping the board | [The Pi Hut](https://thepihut.com/collections/all/products/265-piece-ultimate-heat-shrink-kit) |

> **Why loose headers?** Pre-soldered header pins add about 8 mm of thickness and get in the way of the battery pads on the underside. Without them I can solder wires straight to the board's edge pads and keep the module slim.

### Still to buy

| Part | Approx. price | Purpose | Link |
|---|---|---|---|
| No-clean rosin flux pen (3-pack) | ~£5–8 | Makes soldering the small battery pads much easier | [Amazon UK](https://www.amazon.co.uk/dp/B0C7CJ7BX2) |
| Polyimide (Kapton) tape | from ~£4 | Heat-resistant insulation. Electrical tape is fine for version 1. | [The Pi Hut: maker materials](https://thepihut.com/collections/maker-materials) |

### Already owned

| Item | Notes |
|---|---|
| Tabiger 9-in-1 soldering kit (60 W, 200–450 °C, 900M tips) | Adjustable temperature. Use the small chisel or fine conical tip at about 340 °C. |
| Multimeter | For checking battery polarity and continuity |
| Android phone | Runs the Web Bluetooth app in Chrome |

**Estimated total spend:** about £30–40.

## 6. Wiring

> 🔧 [How It Works](how-it-works.md) explains the circuit, the 100 kΩ resistor and every XIAO pin, and has step-by-step soldering instructions.

> 🧊 The [3D model](3d-model.html) shows where each part sits on the vape and how the wires run. Download the file and open it in a browser to use it.

```
3V3 ──── FSR ────┬──── D1 (wake pin)
                 │
              100 kΩ
                 │
GND ─────────────┘

LiPo (+) ── JST socket ── XIAO BAT+ pad (underside)
LiPo (−) ── JST socket ── XIAO BAT− pad (underside)
```

- **Not pressed:** the FSR's resistance is above 1 MΩ, so D1 reads LOW and almost no current flows.
- **Pressed:** the FSR drops to a few kΩ, D1 goes HIGH and the board wakes up.
- If light presses don't register, swap the 100 kΩ for a **larger** resistor, such as 220 kΩ. (Earlier notes said 47 kΩ, which would make it less sensitive. [How It Works](how-it-works.md#2-why-100-kω) explains why.)
- ⚠️ **Check the JST polarity with the multimeter before connecting the battery.** JST connectors aren't wired the same way by every maker. The battery's red wire must reach BAT+.

## 7. Software plan

All the code lives in this repository.

| Part | Tech | Notes |
|---|---|---|
| **Firmware** (`firmware/`) | Arduino (Seeed nRF52 board package) | Deep sleep and wake on press. Ring buffer of puffs in flash. Custom Bluetooth LE service for time sync and log download. |
| **App** (`app/`) | Plain HTML and JavaScript, Web Bluetooth | One installable app for Chrome or Edge on my PC and Chrome on Android. Hosted for free on GitHub Pages (Web Bluetooth needs https). |
| **Data** | Stored in each browser | Nothing goes to a server unless I choose to add that later. |

Writing the code is done with Claude Code. **Uploading the firmware** needs the XIAO plugged into a computer over USB-C, using the Arduino IDE or `arduino-cli`, or Claude Code running locally.

## 8. Milestones

- [x] Research approaches and choose the clip-on design (approach A)
- [x] Order parts
- [x] Buy flux pen (and tape)
- [x] Parts arrive: check everything is there and undamaged
- [x] **Hello world:** blink the XIAO's LED from the Arduino IDE
- [x] Practise soldering on spare wire and a resistor
- [x] Solder the JST socket to the battery pads, check polarity, test charging
- [x] Wire the FSR and resistor; read presses over USB serial
- [ ] Firmware: low-power sleep, log puffs to flash (written, needs testing)
- [x] Bluetooth test with no wiring: `firmware/ble_test/` and a phone app
- [ ] Firmware: Bluetooth service, tested with the nRF Connect app
- [ ] Web app: connect, sync time, download puffs (written, needs testing)
- [ ] Web app: stats, achievements and buddy (written, needs testing)
- [ ] Install the app on the PC and the phone
- [ ] Measure the sleep current and estimate battery life
- [ ] Mount on the vape (version 1: tape and heat-shrink)
- [ ] Wear it for a week and review the data
- [ ] Print the case and check the fit (version 1.5: taped on)
- [ ] Version 2: 3D-printed clip-on sleeve

## 9. Safety notes

- **LiPo batteries** can catch fire if shorted, punctured or overcharged. Never solder with the battery connected. Cut wires one at a time. Don't squeeze or bend the cell.
- **Check polarity** before plugging the battery in (see [Wiring](#6-wiring)).
- **Soldering iron:** always return it to the stand. Work in a ventilated area, because flux fumes are irritating. Wash your hands after handling solder.
- **Nothing goes inside the vape.** Its own batteries are high-drain 18650s, which are much more dangerous to short than the small LiPo.

## 10. Journal

Newest entries at the bottom.

### 2026-10-15: The idea, research and ordering parts
- Started with the question of whether I could log my vape usage remotely. I found that Geekvape mods have no app or data connection, so I'll need my own hardware.
- Considered four approaches (see [section 4](#4-choosing-an-approach)) and picked the **non-invasive clip-on** option as a first project.
- Chose the **Seeed XIAO nRF52840** for its tiny size, very low power use, built-in Bluetooth and built-in battery charger.
- Checked that my existing **Tabiger soldering kit** is good enough (adjustable temperature is what matters). It's missing flux, so I'm adding a no-clean flux pen.
- Two Pi Hut items were unavailable: a JST pigtail cable, replaced with an extension cable I'll cut in half, and a flux pen, which I'll buy from Amazon instead.
- **Ordered** the parts from The Pi Hut (see [section 5](#5-components)).
- Set up this repository and journal.

### 2026-10-16: Parts arrived, first blink
- All six parts from The Pi Hut arrived undamaged.
- Tested the FSR with the multimeter on the 2M range: it reads over 2 MΩ (shown as `1`) when untouched and about 3 kΩ (0.003) when pressed. With the 100 kΩ pull-down that gives about 3.2 V at D1, so the 100 kΩ resistor stays.
- Installed the **Seeed nRF52 Boards** package in the Arduino IDE (the index download from Seeed's server was slow) and found the board's port by unplugging and replugging it.
- Uploaded the Blink example. The factory demo cycled red, green and blue; after the upload only the red LED blinks, which is what Blink does on this board.
- Wrote `firmware/fsr_test/` to read presses over USB serial, ready for when the FSR is wired.
- Next step: buy the flux pen, practise soldering, then wire the FSR and run the press test.

### 2026-10-16: 3D fit model
- Made an interactive [3D model](3d-model.html) of the parts on the Aegis Legend 5. It has fitted, exploded and fire-button views, plus a wiring diagram and the parts at real size.
- The layout puts the FSR flat on the fire button with its tail wrapped round to the back, and the battery on the back panel with the XIAO on top. The whole stack adds about 10 mm to the back.
- The parts are drawn to real size. The vape's shape, the fire-button position and the FSR tail length are approximate, so check them against the real thing.

### 2026-10-16: A 3D-printed case
- Designed a two-part [case](../case/README.md) (a tray and a press-fit lid) to print on my Ultimaker 2. It holds the LiPo, the JST socket and the XIAO as one unit, and the FSR wires come in through a slot in the side.
- It's 29.2 × 55.2 × 8.9 mm when fitted. The parts sit side by side rather than stacked, which keeps it thinner than the layout in the 3D model.
- The USB-C port sits in a notch in the end wall, so I can charge and upload without opening the case.
- Next step: print it and check the fit with the loose parts before soldering.

### 2026-10-16: Bluetooth works
- Uploaded `firmware/ble_test/` and connected from the Bluefruit Connect app on my phone. The board advertised as VapeLogger, sent a message every second, and answered `ping` with `pong`.
- Two problems on the way:
  - The board stopped showing up on my PC. A quick double-tap of the reset button put it into bootloader mode, which brought back its USB drive and port.
  - Compiling failed with "No such file or directory" because my repo folder path had a space in it (`Git Repositories`). The Seeed toolchain splits paths at spaces, so the fix was a path without spaces.
- Wrote [How It Works](how-it-works.md): the reasoning behind the 100 kΩ resistor and the pins, plus the soldering steps.
- Next step: solder the resistor and the FSR wires, then run the press test.

### 2026-10-17: Case views in the 3D model
- Added three tabs to the [3D model](3d-model.html): the printed case on its own, the parts inside it, and the closed case mounted on the vape. The case is loaded from the real STL files in `case/`, so it matches what gets printed.

### 2026-10-18: Soldered and working on battery
- Soldered the 100 kΩ resistor from D1 to GND, the FSR wires to 3V3 and D1, and the JST battery lead to the BAT pads. Before soldering the lead, I checked its polarity with the multimeter: it read +3.94 V with red as positive.
- `fsr_test` reads 0 to 3 untouched and close to 1000 when pressed, and the red LED lights on a press with only the battery connected.
- What went wrong:
  - My old iron's barrel nut stripped its thread after a tip change, so I bought a Draper 40 W soldering station from Toolstation.
  - Solder balled up and wouldn't stick to the new tip, because it had oxidised from sitting hot without solder on it. It came back with brass wool, tip tinner and a coat of fresh solder. Max heat made it worse, not better.
  - The first GND joint balled on the leg instead of flowing onto the pad. Heating the pad and the leg together with fresh flux fixed it.
  - A messy 3V3 joint sat close to GND and pad 10, so I checked them with the multimeter on 200k before plugging in. They read 80 to 100 kΩ and 55 kΩ respectively, so nothing was bridged.
  - `fsr_test` failed to link with "undefined reference to `Serial`". The fix was adding `#include <Adafruit_TinyUSB.h>` at the top.
  - The port disappeared from the IDE once. **Tools > Reload board data** brought it back.
- Next step: print the case, then start the main firmware (deep sleep, puff logging, Bluetooth and battery level).

### 2026-10-19: Main firmware and the app, written but not yet tested
- Wrote `firmware/vaper_taper/`. It logs each press with its start time and length, keeps the last 2048 in flash, and sends them over Bluetooth with the battery level. It compiles against the Seeed core.
- Changed plan: the board sleeps in **System ON** and checks the FSR every 50 ms, rather than System OFF. System OFF stops the clock, so a press that woke the board wouldn't know what time it was, and the board couldn't advertise for the app to connect.
- The board accepts two connections at once, so my PC and my phone can both stay connected. Each downloads the whole log, so they show the same history.
- Wrote the app in `app/`: one web app for the PC and the phone that can be installed like a normal app. It shows the time since my last puff, my record, the battery, achievements, a buddy that levels up with XP, and a log with day and night counts.
- Nights (01:00 to 08:00 by default, changeable per night) don't count towards streaks, because not vaping while asleep isn't really abstaining. Night puffs are counted separately.
- Next step: upload the firmware and test it with the app.

<!-- Template for new entries:
### YYYY-MM-DD: Title
- What I did
- What went wrong and how I fixed it
- Photos: ![description](images/filename.jpg)
- Next step
-->

## 11. Lessons learned

*(Filled in as I go.)*

- Keep Arduino sketches in a folder path with no spaces. The nRF52 toolchain can't cope with them.
- If the XIAO disappears from the PC, double-tap reset to get into the bootloader.
- Shop stock changes quickly. Have a backup option for small parts.
- Keep the iron's tip tinned: wipe it on brass wool, add a little solder before each joint, and leave a blob on it in the stand. A dull or black tip won't take solder at any temperature.
- Slide heat-shrink on *before* soldering both ends of a wire.
- Measure for shorts between neighbouring pads (GND and 3V3 especially) before plugging in USB.
- If the board's port vanishes in the Arduino IDE, try **Tools > Reload board data** before the double-tap reset.

## 12. Ideas for later

- **Reduction features:** a daily puff budget, a "time since last puff" display, streaks, gradually lowering targets, and a gentle vibration or phone notification when I'm over budget.
- **Context:** tag puffs (work, social, after meals) to find triggers.
- **Better sensing:** add an accelerometer to reject accidental presses, or try the drip-tip pressure sensor (approach B).
- **Enclosure:** a 3D-printed sleeve that clips onto the Aegis Legend 5, which measures 146 × 56 × 26 mm.
- **Dashboard:** optional sync to a home server (such as Grafana) for long-term trends.
