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
- If light presses don't register, swap the 100 kΩ for a 47 kΩ resistor.
- ⚠️ **Check the JST polarity with the multimeter before connecting the battery.** JST connectors aren't wired the same way by every maker. The battery's red wire must reach BAT+.

## 7. Software plan

All the code lives in this repository.

| Part | Tech | Notes |
|---|---|---|
| **Firmware** (`firmware/`) | Arduino (Seeed nRF52 board package) | Deep sleep and wake on press. Ring buffer of puffs in flash. Custom Bluetooth LE service for time sync and log download. |
| **App** (`app/`) | Plain HTML and JavaScript, Web Bluetooth | Runs in Chrome on Android. Hosted for free on GitHub Pages (Web Bluetooth needs https). Can be added to the home screen. |
| **Data** | Stored on the phone | Nothing goes to a server unless I choose to add that later. |

Writing the code is done with Claude Code. **Uploading the firmware** needs the XIAO plugged into a computer over USB-C, using the Arduino IDE or `arduino-cli`, or Claude Code running locally.

## 8. Milestones

- [x] Research approaches and choose the clip-on design (approach A)
- [x] Order parts
- [ ] Buy flux pen (and tape)
- [x] Parts arrive: check everything is there and undamaged
- [x] **Hello world:** blink the XIAO's LED from the Arduino IDE
- [ ] Practise soldering on spare header pins
- [ ] Solder the JST socket to the battery pads, check polarity, test charging
- [ ] Wire the FSR and resistor; read presses over USB serial
- [ ] Firmware: deep sleep, wake on press, log puffs to flash
- [ ] Bluetooth test with no wiring: `firmware/ble_test/` and a phone app
- [ ] Firmware: Bluetooth service, tested with the nRF Connect app
- [ ] Web app: connect, sync time, download puffs
- [ ] Web app: stats and charts
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

<!-- Template for new entries:
### YYYY-MM-DD: Title
- What I did
- What went wrong and how I fixed it
- Photos: ![description](images/filename.jpg)
- Next step
-->

## 11. Lessons learned

*(Filled in as I go.)*

- Shop stock changes quickly. Have a backup option for small parts.

## 12. Ideas for later

- **Reduction features:** a daily puff budget, a "time since last puff" display, streaks, gradually lowering targets, and a gentle vibration or phone notification when I'm over budget.
- **Context:** tag puffs (work, social, after meals) to find triggers.
- **Better sensing:** add an accelerometer to reject accidental presses, or try the drip-tip pressure sensor (approach B).
- **Enclosure:** a 3D-printed sleeve that clips onto the Aegis Legend 5, which measures 146 × 56 × 26 mm.
- **Dashboard:** optional sync to a home server (such as Grafana) for long-term trends.
