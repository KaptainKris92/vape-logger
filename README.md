# Vape Logger

A small clip-on device that automatically logs every puff from my vape (a Geekvape Aegis Legend 5) and sends the data to my phone over Bluetooth. I'm building it to help me cut down: vaping has become a subconscious habit, and the vape's built-in puff counter isn't automatic or detailed enough to show me my patterns.

It's also my first hardware engineering project.

**📓 Read the full story in the [Build Journal](docs/build-journal.md)**: background, design decisions, parts list, wiring, milestones and progress notes.

**✍️ New to hardware? The [build blog](blog/index.md)** tells the same story step by step, in plain language, with photos.

**🔧 Learn [How It Works](docs/how-it-works.md)**: the circuit, why there's a 100 kΩ resistor, what every pin does, and step-by-step soldering instructions.

**🧊 See how it fits in the [3D model](docs/3d-model.html)**: an interactive model of the wiring, the printed case, the parts inside it, and the case mounted on the vape, with a wiring diagram. GitHub shows the file as code, so download it and open it in a browser to use it.

## At a glance

- **Sensor:** a force-sensitive resistor on the fire button
- **Brain:** Seeed XIAO nRF52840 (Bluetooth LE, deep sleep, LiPo charging)
- **Power:** 150 mAh LiPo, charged over USB-C
- **App:** an installable Web Bluetooth app for Chrome/Edge on Windows and Chrome on Android, hosted on GitHub Pages ([app/README.md](app/README.md))

## Repository layout

```
docs/       build journal, 3D fit model, wiring notes, photos
case/       3D-printable case (STL files and the script that makes them)
firmware/   Arduino code for the XIAO
app/        Vaper Taper app for PC and phone (Web Bluetooth)
desktop/    Windows tray app: app/ wrapped in Electron
```

## Status

🟡 Main firmware and app written. Next: upload and test them together.
