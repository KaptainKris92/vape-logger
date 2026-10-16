# How It Works, and How to Solder It

This page explains the electronics behind the Vape Logger: why there's a 100 kΩ resistor, what each pin on the XIAO does, and how the battery is powered and charged. It finishes with step-by-step soldering instructions.

**Contents**

1. [The sensing circuit](#1-the-sensing-circuit)
2. [Why 100 kΩ?](#2-why-100-kω)
3. [The XIAO's pins](#3-the-xiaos-pins)
4. [Power and charging](#4-power-and-charging)
5. [Soldering guide](#5-soldering-guide)

---

## 1. The sensing circuit

```
3V3 ──── FSR ────┬──── D1
                 │
              100 kΩ
                 │
GND ─────────────┘
```

A **force-sensitive resistor (FSR)** is a resistor whose resistance falls as you press it. The board can't measure resistance directly, but it can measure **voltage**. The 100 kΩ resistor turns the FSR's changing resistance into a changing voltage.

The FSR and the resistor sit in a line between 3.3 V and ground, and D1 reads the voltage at the point between them. This arrangement is called a **voltage divider**:

```
V(D1) = 3.3 V × 100 kΩ / (R_FSR + 100 kΩ)
```

| FSR state | R_FSR | Voltage at D1 | D1 reads |
|---|---|---|---|
| Untouched (typical) | 10 MΩ | 0.03 V | LOW |
| Untouched (worst case) | 1 MΩ | 0.30 V | LOW |
| Light press | 30 kΩ | 2.54 V | HIGH |
| Firm press (what my multimeter showed) | 3 kΩ | 3.20 V | HIGH |

The nRF52840 chip counts anything below about **1.0 V** (30% of 3.3 V) as LOW, and anything above about **2.3 V** (70%) as HIGH. Voltages in between aren't reliable. A good design keeps "pressed" and "not pressed" well away from that middle zone, and this one does.

The 100 kΩ resistor is called a **pull-down**: when nothing is pressing the FSR, it pulls D1 down to ground. Without it, D1 would be connected to nothing, or "floating". A floating pin picks up electrical noise from your hand and from nearby wires, and reads random HIGHs and LOWs.

## 2. Why 100 kΩ?

The pull-down value is a trade-off between sensitivity and current. This is how the options compare for a light press (FSR at 30 kΩ):

| Pull-down | D1 on a light press | D1 untouched (FSR at 1 MΩ) | Current while pressed hard |
|---|---|---|---|
| 10 kΩ | 0.83 V, **missed** | 0.03 V | 254 µA |
| 47 kΩ | 2.01 V, unreliable | 0.15 V | 66 µA |
| **100 kΩ** | **2.54 V, HIGH** | **0.30 V, LOW** | **32 µA** |
| 1 MΩ | 3.20 V, HIGH | 1.65 V, **unreliable** | 3 µA |

- **Too small** (10 kΩ): a light press doesn't lift D1 far enough, so it gets missed.
- **Too big** (1 MΩ): an untouched FSR can drift into the unreliable zone, giving false puffs.
- **100 kΩ** sits comfortably in the middle, and it only draws current while the button is pressed. That's a couple of seconds per puff, so it barely touches battery life.

> **Correction:** earlier notes said to swap in a 47 kΩ resistor if light presses didn't register. That's backwards. A *smaller* pull-down makes the sensor *less* sensitive. If light presses are missed, try a **larger** one, such as 220 kΩ.

**Why not use the chip's built-in pull-down?** The nRF52840 can switch on its own internal pull-down resistor, but it's only about 13 kΩ. On a light press that gives just 1.0 V at D1, which is right on the edge and would miss a lot of puffs.

## 3. The XIAO's pins

The board seen from the top, with the USB-C socket pointing up:

```
                ┌──[USB-C]──┐
       D0 / A0  ●           ●  5V
       D1 / A1  ●           ●  GND
       D2 / A2  ●           ●  3V3
       D3 / A3  ●           ●  D10 / MOSI
 D4 / A4 / SDA  ●           ●  D9  / MISO
 D5 / A5 / SCL  ●           ●  D8  / SCK
       D6 / TX  ●           ●  D7  / RX
                └───────────┘
 Underside: BAT+ and BAT− battery pads, plus small pads for NFC and for a debugger
```

| Pin(s) | What it is | Used here? |
|---|---|---|
| **3V3** | 3.3 V output from the board's regulator. It works on battery or USB. | ✅ Powers the FSR |
| **GND** | Ground (0 V), the reference every voltage is measured against | ✅ Bottom of the 100 kΩ |
| **D1 / A1** | General-purpose pin: digital (HIGH/LOW) or analog (0 to 3.3 V as a number) | ✅ Reads the FSR |
| **BAT+ / BAT−** | Battery pads on the underside, connected to the built-in charger | ✅ The LiPo |
| 5V | USB's 5 V, only present while plugged into USB | ❌ See below |
| D0, D2, D3 | General-purpose pins that can also read analog voltages | Spare |
| D4 / SDA, D5 / SCL | I²C, a two-wire bus for sensors | Spare, kept free for a future accelerometer |
| D6 / TX, D7 / RX | UART, an old-style serial port | Spare |
| D8, D9, D10 | SPI, a fast bus for screens and memory chips | Spare |

**Why D1?** Any of the D pins can wake the chip from deep sleep. D1 can also read analog voltages, so later firmware could measure *how hard* the button is pressed, not just whether it is. It isn't one of the bus pins (I²C, UART, SPI), so those stay free for add-ons. D0 would work just as well.

**Why 3V3 and not 5V?** The nRF52840's pins can only take about 3.6 V. Feeding the FSR from 5V would put up to 5 V on D1 and could damage it. The 5V pin also has nothing on it when the device runs on battery.

## 4. Power and charging

- The **LiPo** connects to the BAT+ and BAT− pads. The board has a **charger chip** built in. Plug in USB-C and it charges the battery, at 50 mA by default according to Seeed. That fills the 150 mAh cell in roughly 3 to 4 hours.
- On USB, the board runs from USB and tops up the battery. Unplugged, it runs from the battery through the 3.3 V regulator.
- The plan is for the chip to spend almost all its time in **deep sleep** (System OFF), using only microamps, and to wake on a press. How long the battery lasts depends mostly on how often it wakes to talk Bluetooth. The "measure the sleep current" milestone will turn that into a real number.

## 5. Soldering guide

**Before you start**

- Set the iron to about **340 °C**, or about 300 °C for the FSR pins. Tin the tip, and keep a damp sponge or brass wool handy.
- Use the flux pen on every pad before soldering.
- You need wire. Cut about 10 cm pieces from the **spare half of the JST cable**, the plug end you won't use. Use the red wire for 3V3 and the black one for D1. Mark the D1 wire with a ring of heat-shrink, coloured if your kit has it, so you don't mistake it for ground.
- **The battery stays unplugged** until step 4.

**Step 1: the 100 kΩ resistor (D1 to GND)**

1. Hold the board USB-C up. **D1** is the second pad down on the left, and **GND** is the second pad down on the right. They sit directly opposite each other.
2. Put a strip of Kapton or electrical tape across the metal shield on top of the board. The shield is connected to ground, and the resistor will lie across it.
3. Bend the resistor's legs and push them **down through the D1 and GND holes** from the top. The resistor doesn't have a direction, so either way round is fine.
4. Solder both legs from underneath, then trim them flush so the board can sit flat in the case.

**Step 2: the two FSR wires**

1. Strip about 3 mm from each wire end and tin it, which means putting a little solder on the bare wire.
2. Solder the red wire to **3V3** (third pad down on the right).
3. Solder the marked wire to **D1**, on top of the resistor leg that's already there.
4. Slide a short piece of heat-shrink onto each wire, then solder the other ends to the **two FSR pins**. Either wire can go to either pin. Work quickly, about 2 seconds per pin, because the FSR's plastic tail melts easily. Let it cool between the pins.
5. Slide the heat-shrink over the joints and shrink it with the side of the iron or a lighter held well away.

**Step 3: test the sensor, still on USB**

Upload `firmware/fsr_test/` and open **Tools > Serial Plotter**. Pressing the FSR should make the line jump and light the red LED. If it doesn't, check every joint with the multimeter set to continuity (the beeping setting).

**Step 4: the battery socket (BAT+ and BAT−)**

1. Cut the JST cable and keep the **socket** half, the one the battery plugs into.
2. Plug the battery into that socket. **Keep the two cut ends apart**: if they touch while the battery is connected, that's a short circuit.
3. Set the multimeter to **20** on V⎓. Put the red probe on one cut end and the black probe on the other. If it reads about **+3.7 to +4.2 V**, the wire under the red probe is positive. If it reads minus, it's the other wire.
4. **Unplug the battery.**
5. Strip and tin both ends. Solder the positive wire to **BAT+** and the negative wire to **BAT−** on the underside. Cover the joints with tape or heat-shrink.
6. Plug the battery in, then plug in USB-C. A small charge LED near the USB socket should light while it charges.

**Step 5: put it in the case**

Stick the battery down at the far end of the tray. Put the XIAO on a strip of 1 mm foam tape at the USB end, keeping the tape off the BAT pads. Run the FSR wires out through the slot that faces the fire button, then press the lid on.
