# Vaper Taper for Windows

The app in `../app`, wrapped with [Electron](https://www.electronjs.org/) so it:

- connects to the Vaper Taper by itself, with no device picker and no browser flags,
- keeps running in the tray when you close the window,
- starts with Windows (switch it off from the tray icon's menu).

The app itself isn't copied: this folder only holds `main.js`, which loads `../app`. Any change to the app shows up here at the next build.

## Install

1. Install [Node.js](https://nodejs.org/) (LTS) if it isn't already.
2. In a terminal in this folder, run `npm install`, then `npm run dist`.
3. Run `dist\Vaper Taper Setup 1.0.0.exe`. It installs for your user only, with no admin prompt, and opens the app.

Windows SmartScreen may warn about an unknown publisher, because the installer isn't signed. Click **More info > Run anyway**.

To update after changing the app or `main.js`, run `npm run dist` again and rerun the installer. Your data is kept.

## Use

- Close the window and it keeps running in the tray, next to the clock. Click the icon to bring it back.
- Right-click the tray icon for **Start with Windows** and **Quit**.
- At startup it opens hidden in the tray.
- It tries to connect every 30 seconds while disconnected, so it picks the device up again when it comes back into range.

## Develop

`npm start` runs it straight from the source without installing. "Start with Windows" is greyed out in this mode, so the development copy never registers itself.

## Data

The data lives in `%APPDATA%\Vaper Taper`, separate from Edge or Chrome. It downloads every puff from the device on its first connection. To bring over bedtime changes and the wardrobe from the browser version, use **Settings > Backup** there and import the file here.
