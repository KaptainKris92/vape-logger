# Vape Logger

A small clip-on device that automatically logs every puff from my vape (a Geekvape Aegis Legend 5) and sends the data to my phone over Bluetooth. I'm building it to help me cut down: vaping has become a subconscious habit, and the vape's built-in puff counter isn't automatic or detailed enough to show me my patterns.

It's also my first hardware engineering project.

**📓 Read the full story in the [Build Journal](docs/build-journal.md)**: background, design decisions, parts list, wiring, milestones and progress notes.

## At a glance

- **Sensor:** a force-sensitive resistor on the fire button
- **Brain:** Seeed XIAO nRF52840 (Bluetooth LE, deep sleep, LiPo charging)
- **Power:** 150 mAh LiPo, charged over USB-C
- **App:** a Web Bluetooth page in Chrome on Android, hosted on GitHub Pages

## Repository layout

```
docs/       build journal, wiring notes, photos
firmware/   Arduino code for the XIAO
app/        Web Bluetooth phone app            (coming soon)
```

## Status

🟢 Parts arrived. The board is programmed and blinking.
