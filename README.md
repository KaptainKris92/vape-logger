# Vaper Taper

*Taper the vaper.*

A small clip-on device that automatically logs every puff from my vape (a Geekvape Aegis Legend 5) and sends the data to my phone and PC over Bluetooth. I built it to help me cut down: vaping had become a subconscious habit, and the vape's built-in puff counter isn't automatic or detailed enough to show me my patterns.

It's also my first hardware engineering project. The repo is still called `vape-logger`.

**✍️ New to hardware? Read the [build blog](https://kaptainkris92.github.io/blog/building-vaper-taper/)**: the whole story step by step, in plain language, with photos.

**📓 The [Build Journal](docs/build-journal.md)** has the background, design decisions, parts list, wiring, milestones and dated progress notes.

**🔧 [How It Works](docs/how-it-works.md)** explains the circuit, why there's a 100 kΩ resistor, what every pin does, and how to solder it.

**🧊 The [3D model](https://kaptainkris92.github.io/projects/vaper-taper/3d-model.html)** shows the wiring, the printed case, the parts inside it, and the case mounted on the vape.

## At a glance

- **Sensor:** a force-sensitive resistor on the fire button
- **Brain:** Seeed XIAO nRF52840 (Bluetooth LE, low-power sleep, LiPo charging)
- **Power:** 150 mAh LiPo, charged over USB-C. It drops about 5% a day.
- **Case:** two-part 3D-printed tray and lid, taped to the back of the vape
- **Apps:** an installable Web Bluetooth app for Chrome on Android, hosted at <https://kaptainkris92.github.io/vape-logger/> ([app/README.md](app/README.md)), and the same app as a Windows tray app that connects by itself ([desktop/README.md](desktop/README.md))

## Repository layout

```
docs/       build journal, how it works, 3D fit model, photos
case/       3D-printable case (STL files and the script that makes them)
firmware/   Arduino code for the XIAO (the main sketch is firmware/vaper_taper)
app/        Vaper Taper web app for PC and phone (Web Bluetooth)
desktop/    Windows tray app: app/ wrapped in Electron
```

## Status

🟢 Built, mounted on the vape and in daily use.

Next:

- Measure the sleep current to work out the battery life properly.
- Find out why the Bluetooth link sometimes drops. The apps recover, but the cause is unknown.
- Replace the tape with a clip-on sleeve that fits the Aegis Legend 5.
