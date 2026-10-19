# Vaper Taper app

One web app for both the PC and the phone. It talks to the device over Web Bluetooth, which works in **Chrome or Edge** on Windows and in **Chrome** on Android. Both can install it, so it opens in its own window like a normal app.

There's no build step: it's plain HTML, CSS and JavaScript.

## Where it lives

- **On Windows, the easiest way:** the tray app in [`../desktop`](../desktop/README.md). It's this same app, but it connects by itself, stays in the tray and starts with Windows.

- **Online:** GitHub Pages publishes this folder at <https://kaptainkris92.github.io/vape-logger/> whenever `app/` changes on `main`. Turn this on once in the repo's **Settings > Pages > Source: GitHub Actions**.
- **On the PC without GitHub:** open a terminal in this folder and run `python -m http.server 8000`, then go to <http://localhost:8000>. Web Bluetooth needs https, but `localhost` counts as safe.

## Installing it

- **PC (Chrome or Edge):** open the page, then click the install icon at the right of the address bar (or **⋮ > Cast, save and share > Install page as app**). It gets a Start menu entry and its own window.
- **Android (Chrome):** open the page, then **⋮ > Add to home screen > Install**.

## Reconnecting after a refresh

Edge and Chrome only let a page reconnect to a device without asking if a flag is on. Without it, you click **Connect** after every refresh. On each browser:

1. Open `edge://flags` (or `chrome://flags`).
2. Turn on **Experimental Web Platform features** (`#enable-experimental-web-platform-features`).
3. Restart the browser, then connect once more. After that the app reconnects by itself, including after a refresh or when the device comes back into range.

Older versions also needed **Use the new permissions backend for Web Bluetooth**. Edge 155 no longer has that flag, and doesn't need it.

**Settings > Device** shows a reminder while the flag is off.

## Using it on both

- The device can be connected to the PC and the phone at the same time. Each one downloads the whole log, so they show the same puffs.
- The device keeps the last 2048 puffs. As long as each one connects every week or so, nothing is missed.
- Bedtime changes and the wardrobe are saved separately on each. **Settings > Backup** downloads a file you can import on the other to combine them.
- Leaving the app open on the PC keeps it connected, so puffs show up within a second or two. The phone catches up whenever you open it.

## How the numbers work

- **Vape-free time** counts awake time only. Each night runs from a bedtime to a wake-up (01:00 to 08:00 unless changed), and that time is skipped. Every puff restarts the clock, including night puffs.
- **Night puffs** are counted separately. If you were up late, change that night's bedtime in **Log** or on the home page, and the puffs before it count as daytime instead.
- **XP** comes from the gaps between puffs: an hour without vaping is worth 60 XP, two hours 240 XP, and longer gaps keep earning. Each night without vaping adds 150 XP.
- **Coins** come from XP (1 per 10) and from achievements. Spend them in **Buddy > Shop**.
- Stats only count data the app has downloaded. When the device isn't connected, the home page says when it last synced.

## Files

| File | What it does |
|---|---|
| `index.html`, `css/style.css` | The page and its look (day and night themes) |
| `js/app.js` | Wires everything to the page |
| `js/ble.js` | The Bluetooth protocol (see the top of `firmware/vaper_taper/vaper_taper.ino`) |
| `js/stats.js` | Nights, streaks, XP, levels and achievements |
| `js/store.js` | Saving to the browser's local storage, and backups |
| `js/companion.js` | ⚠️ **Spoilers:** the buddy's looks and the shop |
| `sw.js`, `manifest.webmanifest`, `icons/` | Make it installable and let it open offline |
| `tests/` | `node --test app/tests/stats.test.mjs` |
