// Vaper Taper for Windows.
//
// Shows the app from ../app in its own window, keeps running in the tray when
// the window is closed, starts with Windows, and connects to the device by
// itself, so there's no device picker and no browser flags.

const { app, BrowserWindow, Menu, Tray, nativeImage, net, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const APP_DIR = app.isPackaged ? path.join(process.resourcesPath, 'web') : path.join(__dirname, '..', 'app');
const DEVICE_NAME = 'VaperTaper';
const START_URL = 'vapertaper://app/index.html';

// A private https-like address for the app, so Web Bluetooth and local
// storage work as they do on the web.
protocol.registerSchemesAsPrivileged([
  { scheme: 'vapertaper', privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

let win = null;
let tray = null;
let quitting = false;

function createWindow(hidden) {
  win = new BrowserWindow({
    width: 1100,
    height: 820,
    show: !hidden,
    title: 'Vaper Taper',
    icon: path.join(APP_DIR, 'icons', 'icon-192.png'),
    autoHideMenuBar: true,
    webPreferences: { backgroundThrottling: false },  // keep the clock and Bluetooth going in the tray
  });

  // The page asks for a device; pick the Vaper Taper as soon as it is seen,
  // or give up after 15 s and let the page try again later.
  let giveUp = null;
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    const device = devices.find((d) => d.deviceName === DEVICE_NAME);
    if (device) {
      clearTimeout(giveUp);
      giveUp = null;
      callback(device.deviceId);
    } else if (!giveUp) {
      giveUp = setTimeout(() => { giveUp = null; callback(''); }, 15000);
    }
  });

  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
  });

  win.loadURL(START_URL);
}

// Asks the page to connect if it isn't already. Runs as if from a click,
// which Web Bluetooth requires.
function autoConnect() {
  if (!win || win.isDestroyed()) return;
  win.webContents
    .executeJavaScript('window.vaperTaperAutoConnect && window.vaperTaperAutoConnect()', true)
    .catch(() => {});
}

function show() {
  win.show();
  win.focus();
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(APP_DIR, 'icons', 'icon-192.png')).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Vaper Taper');
  tray.on('click', show);
  const menu = () => Menu.buildFromTemplate([
    { label: 'Open Vaper Taper', click: show },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      enabled: app.isPackaged,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked, args: ['--hidden'] }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu());
  tray.on('right-click', () => tray.setContextMenu(menu()));
}

// Turn on "Start with Windows" the first time the installed app runs.
function firstRun() {
  const marker = path.join(app.getPath('userData'), 'first-run-done');
  if (!app.isPackaged || fs.existsSync(marker)) return;
  app.setLoginItemSettings({ openAtLogin: true, args: ['--hidden'] });
  fs.writeFileSync(marker, '');
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => win && show());

  app.whenReady().then(() => {
    protocol.handle('vapertaper', (request) => {
      const { pathname } = new URL(request.url);
      const file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname === '/' ? '/index.html' : pathname)));
      if (!file.startsWith(APP_DIR)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    });

    firstRun();
    createWindow(process.argv.includes('--hidden'));
    buildTray();
    win.webContents.on('did-finish-load', autoConnect);
    setInterval(autoConnect, 30000);
  });

  app.on('before-quit', () => { quitting = true; });
  // Closing the window only hides it; quit from the tray.
  app.on('window-all-closed', (e) => e.preventDefault());
}
