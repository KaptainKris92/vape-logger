import * as store from './store.js';
import { VaperTaper, supported } from './ble.js';
import {
  ACHIEVEMENTS, awakeMs, computeStats, dateKey, gapXp, levelInfo, nextAchievement,
  nightAt, nightTimes, nightWindow, sessionGaps, shiftKey,
} from './stats.js';
import { ITEMS, SLOTS, STAGES, companionSvg, stageFor } from './companion.js';

const $ = (id) => document.getElementById(id);
const MIN = 60000;
const LOW_BATTERY = 20;

const device = new VaperTaper();
const isDesktop = navigator.userAgent.includes('Electron');  // the Windows app in desktop/
if (isDesktop) device.freshLookupAfter = 3;
window.vaperTaper = device;  // handy for checking the connection from DevTools
let inSync = false;   // connected and the whole log is downloaded
let stats = null;     // from computeStats(); refreshed every minute and on changes
let logDays = 14;
const openDays = new Set();  // log days the reader has expanded, kept across re-renders

// ---------- Formatting ----------

function duration(ms, seconds = false) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60), s = total % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return seconds ? `${h}h ${m}m ${String(s).padStart(2, '0')}s` : `${h}h ${m}m`;
  return seconds ? `${m}m ${String(s).padStart(2, '0')}s` : `${m}m`;
}

const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const minToInput = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
const inputToMin = (value, isBedtime) => {
  const [h, m] = value.split(':').map(Number);
  const min = h * 60 + m;
  return isBedtime && min >= 720 ? min - 1440 : min;
};
const dayLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  $('toasts').append(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------- Stats ----------

function asOf() {
  const d = store.get();
  return inSync ? Date.now() : Math.max(d.syncedAt, d.startedAt);
}

function recompute() {
  const d = store.get();
  stats = computeStats({
    puffTimes: d.puffs.map((p) => p[0]),
    startedAt: d.startedAt,
    asOf: asOf(),
    settings: d.settings,
    overrides: d.nights,
  });
  stats.asOf = asOf();
  checkAchievements();
  checkLevel();
  render();
}

function coins() {
  const d = store.get();
  const fromAwards = ACHIEVEMENTS.filter((a) => d.achievements[a.id]).reduce((sum, a) => sum + a.coins, 0);
  return Math.floor(liveXp() / 10) + fromAwards - d.spent;
}

// The current gap keeps growing between full recomputes.
function liveGapMs() {
  if (!stats) return 0;
  if (!inSync) return stats.currentGapMs;
  const d = store.get();
  return stats.currentGapMs + awakeMs(stats.asOf, Date.now(), d.settings, d.nights);
}

function liveXp() {
  if (!stats) return 0;
  return Math.floor(stats.xp - gapXp(stats.currentGapMs / MIN) + gapXp(liveGapMs() / MIN));
}

function checkAchievements() {
  const d = store.get();
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!d.achievements[a.id] && a.test(stats)) {
      d.achievements[a.id] = Date.now();
      changed = true;
      toast(`🏆 ${a.title}! +${a.coins} coins`);
    }
  }
  if (changed) store.save();
}

function checkLevel() {
  const d = store.get();
  const level = levelInfo(liveXp()).level;
  if (level <= d.seenLevel) return;
  const stage = stageFor(level);
  d.seenLevel = level;
  if (stage > d.seenStage) {
    d.seenStage = stage;
    evolve(stage, level);
  } else {
    toast(`⭐ Level up! ${d.settings.name} is now level ${level}.`);
  }
  store.save();
}

function evolve(stage, level) {
  const d = store.get();
  const dlg = $('evolve-dialog');
  $('evolve-text').textContent = `Level ${level}! Something is happening to ${d.settings.name}…`;
  $('evolve-art').innerHTML = companionSvg(stage - 1, d.worn, { id: 'ev' });
  $('evolve-art').classList.add('hidden');
  $('evolve-ok').hidden = true;
  dlg.showModal();
  setTimeout(() => {
    $('evolve-art').innerHTML = companionSvg(stage, d.worn, { id: 'ev' });
    $('evolve-art').classList.remove('hidden');
    $('evolve-text').textContent = `${d.settings.name} became a ${STAGES[stage].name}!`;
    $('evolve-ok').hidden = false;
  }, 2200);
}

// ---------- Rendering ----------

function nightNow() {
  const d = store.get();
  return nightAt(Date.now(), d.settings, d.nights);
}

function renderTicker() {
  if (!stats) return;
  const d = store.get();
  const night = nightNow();
  const gap = liveGapMs();
  $('streak').textContent = duration(gap, true);
  $('streak-sub').textContent = stats.lastPuff
    ? `Since your last puff at ${clock(stats.lastPuff)} on ${dayLabel(dateKey(stats.lastPuff))}`
    : 'No puffs logged yet';
  const stale = !inSync;
  $('stale').hidden = !stale;
  if (stale) {
    $('stale').textContent = d.syncedAt
      ? `Last synced ${duration(Date.now() - d.syncedAt)} ago. Connect to update.`
      : 'Not synced yet. Connect to your Vaper Taper.';
  }
  $('record').textContent = duration(Math.max(stats.longestGapMs, gap));

  const xp = liveXp();
  const lv = levelInfo(xp);
  for (const p of ['home', 'buddy']) {
    $(`${p}-xpbar`).style.width = `${Math.round(lv.progress * 100)}%`;
  }
  $('home-xp').textContent = `${xp - lv.from} / ${lv.to - lv.from} XP`;
  $('buddy-xp').textContent = `${xp.toLocaleString('en-GB')} XP · ${lv.to - xp} to the next level`;
  $('home-coins').textContent = `🪙 ${coins()}`;

  const next = nextAchievement(d.achievements);
  if (next && next.id.startsWith('gap_')) {
    const target = Number(next.id.slice(4, -1)) * MIN;
    $('next-bar').style.width = `${Math.min(100, (gap / target) * 100)}%`;
  }
  document.documentElement.dataset.mode = night ? 'night' : 'day';
  $('mode-banner').textContent = night
    ? `🌙 Night time until ${clock(night.end)}. Sleep doesn't count, so the clock is paused. Night puffs are logged separately.`
    : '☀️ Daytime. Every awake minute without a puff counts.';
}

function render() {
  const d = store.get();
  const night = nightNow();
  const lv = levelInfo(liveXp());
  const stage = stageFor(lv.level);

  // Home
  $('home-buddy').innerHTML = companionSvg(stage, d.worn, { sleeping: !!night, id: 'h' });
  $('home-name').textContent = d.settings.name;
  $('home-level').textContent = `Level ${lv.level} ${STAGES[stage].name}`;

  const todayKey = dateKey(Date.now());
  const today = stats.days.find((x) => x.key === todayKey);
  const lastNight = stats.nights.find((x) => x.key === todayKey);
  $('today-count').textContent = today ? today.puffs : 0;
  $('night-count').textContent = lastNight ? lastNight.puffs : 0;
  const dayKey = logDayKey(Date.now(), d);
  const sessions = daySessions(d.puffs.filter((p) => p[0] <= stats.asOf && logDayKey(p[0], d) === dayKey)
    .map((p) => ({ t: p[0], night: !!nightAt(p[0], d.settings, d.nights) })), d);
  $('today-gap').textContent = sessions.averageMs === null ? '–' : duration(sessions.averageMs);
  $('today-sessions').textContent = sessionText(sessions);
  const nt = nightTimes(todayKey, d.settings, d.nights);
  $('night-times').textContent = `${minToInput(nt.bedMin)} to ${minToInput(nt.wakeMin)}.`;

  const next = nextAchievement(d.achievements);
  $('next-title').textContent = next ? next.title : 'All done. Amazing!';
  $('next-detail').textContent = next ? `${next.detail} +${next.coins} coins` : '';
  if (next && next.id.startsWith('day_')) $('next-bar').style.width = `${(stats.bestCleanDays / Number(next.id.slice(4))) * 100}%`;
  if (next && next.id.startsWith('night_')) $('next-bar').style.width = `${(stats.bestCleanNights / Number(next.id.slice(6))) * 100}%`;
  if (!next) $('next-bar').style.width = '100%';

  renderAwards();
  renderBuddy(stage, lv, !!night);
  renderLog();
  renderSettings();
  renderTicker();
}

function renderAwards() {
  const d = store.get();
  const got = ACHIEVEMENTS.filter((a) => d.achievements[a.id])
    .sort((a, b) => d.achievements[b.id] - d.achievements[a.id]);
  // The next goal in each group (hours, whole days, nights); the rest stay hidden.
  const next = ['gap_', 'day_', 'night_']
    .map((g) => ACHIEVEMENTS.find((a) => a.id.startsWith(g) && !d.achievements[a.id]))
    .filter(Boolean);
  const hidden = ACHIEVEMENTS.length - got.length - next.length;
  const li = (icon, title, sub, cls = '') =>
    `<li class="${cls}"><span class="icon">${icon}</span><div><strong>${title}</strong><p class="sub">${sub}</p></div></li>`;
  $('awards').innerHTML =
    next.map((a) => li('🎯', `Next: ${a.title}`, `${a.detail} +${a.coins} coins`, 'locked')).join('') +
    got.map((a) => li('🏆', a.title, `${a.detail} Unlocked ${new Date(d.achievements[a.id]).toLocaleDateString('en-GB')}.`)).join('') +
    (hidden > 0 ? li('❔', `${hidden} more to discover`, 'Keep going to find them.', 'locked') : '');
}

function renderBuddy(stage, lv, sleeping) {
  const d = store.get();
  $('buddy-art').innerHTML = companionSvg(stage, d.worn, { sleeping, id: 'b' });
  $('buddy-name').textContent = d.settings.name;
  $('buddy-level').textContent = `Level ${lv.level} ${STAGES[stage].name}`;
  $('buddy-coins').textContent = `🪙 ${coins()} coins`;

  const card = (item, actions, cls = '') => `<div class="item ${cls}">
      <div class="buddy-art">${companionSvg(stage, { [item.slot]: item.id }, { id: `i${item.id}` })}</div>
      <p><strong>${item.name}</strong></p>${actions}</div>`;

  const owned = ITEMS.filter((i) => d.owned.includes(i.id));
  $('wardrobe').innerHTML = owned.length
    ? owned.map((i) => d.worn[i.slot] === i.id
      ? card(i, `<button class="secondary" data-takeoff="${i.slot}">Take off</button>`, 'worn')
      : card(i, `<button data-wear="${i.id}">Wear</button>`)).join('')
    : '<p class="sub">Nothing yet. Buy something from the shop.</p>';

  const forSale = ITEMS.filter((i) => i.level <= lv.level && !d.owned.includes(i.id));
  const wallet = coins();
  $('shop').innerHTML = forSale.length
    ? forSale.map((i) => card(i, `<button data-buy="${i.id}" ${wallet < i.cost ? 'disabled' : ''}>🪙 ${i.cost}</button>`)).join('')
    : '<p class="sub">Nothing for sale right now.</p>';
}

// A day in the log runs from one night's bedtime to the next, so it holds
// that night's puffs and the day after it.
function logDayKey(t, d) {
  const night = nightAt(t, d.settings, d.nights);
  if (night) return night.key;
  const k = dateKey(t);
  return t < nightWindow(k, d.settings, d.nights).start ? shiftKey(k, -1) : k;
}

// Sessions among a log day's awake puffs ({ t, night } objects).
const daySessions = (puffs, d) =>
  sessionGaps(puffs.filter((p) => !p.night).map((p) => p.t), (d.settings.sessionMin || 5) * MIN);
const sessionText = (s) => (s.sessions ? `${s.sessions} session${s.sessions === 1 ? '' : 's'}` : 'No sessions yet');

const HOUR = 3600000;
const hourLabel = (t) => `${String(new Date(t).getHours()).padStart(2, '0')}:00`;
const nextHour = (t) => { const x = new Date(t); x.setHours(x.getHours() + 1); return x.getTime(); };

// Puffs per hour across one log day, with the night shaded and the day's
// longest gap marked. The exact times stay in "Show times" underneath.
function dayChart(key, puffs, d) {
  const night = nightWindow(key, d.settings, d.nights);
  const nextNight = nightWindow(shiftKey(key, 1), d.settings, d.nights);
  const start = new Date(night.start).setMinutes(0, 0, 0);
  const end = new Date(nextNight.start + HOUR - 1).setMinutes(0, 0, 0);
  const now = Date.now();
  const P = (t) => ((t - start) / (end - start)) * 100;

  const bins = [];
  for (let t = start; t < end; t = nextHour(t)) {
    const inBin = puffs.filter((p) => p.t >= t && p.t < nextHour(t));
    bins.push({ t, count: inBin.length, night: inBin.filter((p) => p.night).length });
  }
  const yMax = Math.max(1, ...bins.map((b) => b.count));

  // Longest gap in the awake part of the day (up to now, for today).
  const dayEnd = Math.min(nextNight.start, stats.asOf);
  let gap = null;
  if (dayEnd > night.end) {
    const marks = [night.end, ...puffs.filter((p) => !p.night).map((p) => p.t), dayEnd];
    for (let i = 1; i < marks.length; i++) {
      if (!gap || marks[i] - marks[i - 1] > gap.to - gap.from) gap = { from: marks[i - 1], to: marks[i] };
    }
  }

  const cols = bins.map((b) => {
    const label = `${hourLabel(b.t)} to ${hourLabel(nextHour(b.t))}`;
    const value = `${b.count} puff${b.count === 1 ? '' : 's'}`;
    const extra = b.night ? (b.night === b.count ? 'at night' : `${b.night} at night`) : '';
    const h = b.count ? Math.max(4, (b.count / yMax) * 100) : 0;
    return `<div class="dc-slot" tabindex="0" data-value="${value}" data-label="${label}${extra ? ` · ${extra}` : ''}"
        aria-label="${label}: ${value}${extra ? `, ${extra}` : ''}">${h ? `<div class="dc-col" style="height:${h.toFixed(1)}%"></div>` : ''}</div>`;
  }).join('');

  const ticks = bins.filter((b) => new Date(b.t).getHours() % 3 === 0).map((b) =>
    `<span class="${new Date(b.t).getHours() % 6 ? 'minor' : ''}" style="left:${P(b.t).toFixed(2)}%">${hourLabel(b.t)}</span>`).join('');

  const nightTotal = puffs.filter((p) => p.night).length;
  const gapText = gap ? `Longest gap ${duration(gap.to - gap.from)}` : '';
  const gapMid = gap ? Math.min(85, Math.max(15, (P(gap.from) + P(gap.to)) / 2)) : 0;
  const summary = `Puffs per hour: ${puffs.length - nightTotal} in the day, ${nightTotal} at night.${gap ? ` ${gapText}.` : ''}`;

  return `<div class="daychart" role="group" aria-label="${summary}">
    <p class="dc-title">Puffs per hour</p>
    <div class="dc-plot">
      <div class="dc-night" style="left:${P(night.start).toFixed(2)}%;width:${(P(night.end) - P(night.start)).toFixed(2)}%"><span>Asleep</span></div>
      ${gap ? `<div class="dc-gap" style="left:${P(gap.from).toFixed(2)}%;width:${(P(gap.to) - P(gap.from)).toFixed(2)}%"></div>
        <span class="dc-gap-label" style="left:${gapMid.toFixed(2)}%">${gapText}</span>` : ''}
      <div class="dc-top"></div>
      <span class="dc-y dc-y-max">${yMax}</span><span class="dc-y dc-y-zero">0</span>
      ${start <= now && now < end ? `<div class="dc-now" style="left:${P(now).toFixed(2)}%" title="Now"></div>` : ''}
      <div class="dc-cols">${cols}</div>
    </div>
    <div class="dc-x">${ticks}</div>
  </div>`;
}

function renderLog() {
  const d = store.get();
  const byDay = new Map();
  for (const p of d.puffs) {
    if (p[0] > stats.asOf) continue;
    const key = logDayKey(p[0], d);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push({ t: p[0], dur: p[1], night: !!nightAt(p[0], d.settings, d.nights) });
  }

  const html = [];
  let key = dateKey(Date.now());
  for (let i = 0; i < logDays; i++, key = shiftKey(key, -1)) {
    const puffs = byDay.get(key) || [];
    const nightCount = puffs.filter((p) => p.night).length;
    const nt = nightTimes(key, d.settings, d.nights);
    const edited = d.nights[key] ? ' (changed)' : '';
    const open = openDays.has(key);
    const sessions = daySessions(puffs, d);
    const avgGap = sessions.averageMs === null ? '' : duration(sessions.averageMs);
    html.push(`<details class="day" data-key="${key}"${open ? ' open' : ''}><summary>
        <strong>${dayLabel(key)}</strong>
        <span class="counts">☀️ ${puffs.length - nightCount} · 🌙 ${nightCount}${avgGap ? ` · ⏱️ ${avgGap}` : ''}</span>
      </summary>
      ${open ? dayChart(key, puffs, d) : ''}
      ${sessions.sessions ? `<p class="sub">${sessionText(sessions)}${avgGap ? `, ${avgGap} apart on average` : ''}.</p>` : ''}
      <p class="sub">Night ${minToInput(nt.bedMin)} to ${minToInput(nt.wakeMin)}${edited}
        <button class="link" data-night="${key}">Change</button></p>
      ${puffs.length ? `<details class="times"><summary>Show times (${puffs.length})</summary><ul>${puffs.map((p) =>
        `<li class="${p.night ? 'night' : ''}">${clock(p.t)} · ${(p.dur / 1000).toFixed(1)} s${p.night ? ' 🌙' : ''}</li>`).join('')}</ul></details>`
        : '<p class="sub">No puffs.</p>'}
    </details>`);
  }
  $('log').innerHTML = html.join('');
  const oldest = d.puffs.length ? dateKey(Math.min(d.puffs[0][0], d.startedAt)) : dateKey(d.startedAt);
  $('log-more').hidden = shiftKey(dateKey(Date.now()), -logDays) < oldest;
}

function renderSettings() {
  const d = store.get();
  if (document.activeElement !== $('set-bed')) $('set-bed').value = minToInput(d.settings.bedMin);
  if (document.activeElement !== $('set-wake')) $('set-wake').value = minToInput(d.settings.wakeMin);
  if (document.activeElement !== $('set-name')) $('set-name').value = d.settings.name;
  if (document.activeElement !== $('set-session')) $('set-session').value = d.settings.sessionMin;

  const s = device.status;
  const rows = [
    ['Bluetooth', supported ? device.state : 'not available in this browser'],
    ['Battery', s ? `${s.battery}% (${(s.batteryMv / 1000).toFixed(2)} V)${s.usbPower ? ', on USB power' : ''}` : '–'],
    ['Puffs on device', s ? `${s.total - s.first} (numbers ${s.first} to ${s.total - 1})` : '–'],
    ['Device clock', s ? (s.timeSet ? 'set' : 'not set') : '–'],
    ['Log id', s ? s.logId.toString(16) : '–'],
    ['Puffs in this app', String(d.puffs.length)],
    ['Last full sync', d.syncedAt ? new Date(d.syncedAt).toLocaleString('en-GB') : 'never'],
  ];
  if (d.unknownTime) rows.push(['Puffs with no time', `${d.unknownTime} (logged before the clock was set, not counted)`]);
  $('device-info').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`).join('');
  $('disconnect').hidden = device.state === 'disconnected';
  $('reconnect-hint').hidden = !supported || !!navigator.bluetooth.getDevices || isDesktop;
}

function renderBattery() {
  const d = store.get();
  const b = d.lastBattery;
  const el = $('battery');
  el.hidden = !b;
  if (!b) return;
  const live = device.state === 'connected';
  el.textContent = `🔋 ${b.pct}%${live ? '' : ` at ${clock(b.at)}`}`;
  el.classList.toggle('low', b.pct <= LOW_BATTERY);
  $('low-battery').hidden = b.pct > LOW_BATTERY || device.status?.usbPower;
  $('low-battery').textContent = `Vaper Taper's battery is at ${b.pct}%. Charge it over USB-C soon.`;
}

// ---------- Device events ----------

device.getNext = (logId) => store.get().devices[logId]?.next ?? 0;

device.addEventListener('state', (e) => {
  const btn = $('connect');
  btn.dataset.state = e.detail;
  btn.textContent = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Connect' }[e.detail];
  if (e.detail !== 'connected' && inSync) {
    inSync = false;
    store.get().syncedAt = Date.now();
    store.save();
    recompute();
  }
  renderSettings();
  renderBattery();
});

device.addEventListener('battery', (e) => {
  store.get().lastBattery = { pct: e.detail, at: Date.now() };
  store.save();
  renderBattery();
});

device.addEventListener('status', (e) => {
  const d = store.get();
  if (e.detail.total > (d.devices[e.detail.logId]?.next ?? 0)) inSync = false;
  renderSettings();
});

device.addEventListener('records', (e) => {
  const { logId, records, total, done } = e.detail;
  const d = store.get();
  const added = store.addRecords(logId, records);
  d.devices[logId] = { next: total };
  if (done) {
    inSync = true;
    d.syncedAt = Date.now();
  }
  store.save();
  if (added && records.length > 1) toast(`Downloaded ${added} puff${added > 1 ? 's' : ''}.`);
  recompute();
});

// ---------- UI events ----------

$('connect').addEventListener('click', async () => {
  if (!supported || device.state !== 'disconnected') return;
  try {
    await device.choose();
  } catch (e) {
    if (e.name !== 'NotFoundError') toast(`Couldn't connect: ${e.message}`);
  }
});

$('disconnect').addEventListener('click', () => device.disconnect());

function showView(name) {
  const btn = document.querySelector(`.tabs button[data-view="${name}"]`);
  if (!btn) return;
  document.querySelectorAll('.tabs button').forEach((b) => b.removeAttribute('aria-current'));
  btn.setAttribute('aria-current', 'page');
  document.querySelectorAll('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  history.replaceState(null, '', name === 'home' ? location.pathname : `#${name}`);
  window.scrollTo(0, 0);
}
document.querySelector('.tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) showView(btn.dataset.view);
});

$('view-buddy').addEventListener('click', (e) => {
  const d = store.get();
  const t = e.target.closest('button');
  if (!t) return;
  if (t.dataset.buy) {
    const item = ITEMS.find((i) => i.id === t.dataset.buy);
    if (coins() < item.cost) return;
    d.spent += item.cost;
    d.owned.push(item.id);
    d.worn[item.slot] = item.id;
    toast(`${d.settings.name} loves the ${item.name.toLowerCase()}!`);
  } else if (t.dataset.wear) {
    const item = ITEMS.find((i) => i.id === t.dataset.wear);
    d.worn[item.slot] = item.id;
  } else if (t.dataset.takeoff) {
    delete d.worn[t.dataset.takeoff];
  } else {
    return;
  }
  store.save();
  render();
});

let editingNight = null;
function openNight(key) {
  const d = store.get();
  editingNight = key;
  const nt = nightTimes(key, d.settings, d.nights);
  $('night-title').textContent = `Night before ${dayLabel(key)}`;
  $('night-bed').value = minToInput(nt.bedMin);
  $('night-wake').value = minToInput(nt.wakeMin);
  $('night-dialog').showModal();
}
$('edit-last-night').addEventListener('click', () => openNight(dateKey(Date.now())));
$('log').addEventListener('click', (e) => {
  const key = e.target.closest('button[data-night]')?.dataset.night;
  if (key) openNight(key);
});
$('night-dialog').addEventListener('close', () => {
  const d = store.get();
  const action = $('night-dialog').returnValue;
  if (action === 'default') delete d.nights[editingNight];
  if (action === 'save') {
    const bedMin = inputToMin($('night-bed').value, true);
    const wakeMin = inputToMin($('night-wake').value, false);
    if (wakeMin <= bedMin) return toast('Wake-up has to be after bedtime.');
    d.nights[editingNight] = { bedMin, wakeMin };
  }
  if (action === 'default' || action === 'save') { store.save(); recompute(); }
});
// Remember which days are open, and draw a day's chart when it's opened.
$('log').addEventListener('toggle', (e) => {
  const day = e.target;
  if (!day.matches('details.day')) return;
  if (day.open && !openDays.has(day.dataset.key)) { openDays.add(day.dataset.key); renderLog(); }
  if (!day.open) openDays.delete(day.dataset.key);
}, true);

// One tooltip for every chart column, on hover, tap or keyboard focus.
function showTip(slot) {
  const tip = $('dc-tip');
  const value = document.createElement('strong');
  value.textContent = slot.dataset.value;
  const label = document.createElement('span');
  label.textContent = slot.dataset.label;
  tip.replaceChildren(value, label);
  tip.hidden = false;
  const r = slot.getBoundingClientRect();
  tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
  tip.style.top = `${r.top - tip.offsetHeight - 8}px`;
}
const hideTip = () => { $('dc-tip').hidden = true; };
$('log').addEventListener('pointerover', (e) => { const s = e.target.closest('.dc-slot'); if (s) showTip(s); });
$('log').addEventListener('pointerout', (e) => { if (e.target.closest('.dc-slot')) hideTip(); });
$('log').addEventListener('focusin', (e) => { const s = e.target.closest('.dc-slot'); if (s) showTip(s); });
$('log').addEventListener('focusout', hideTip);
window.addEventListener('scroll', hideTip, { passive: true });

$('log-more').addEventListener('click', () => { logDays += 14; renderLog(); });

$('set-bed').addEventListener('change', (e) => {
  store.get().settings.bedMin = inputToMin(e.target.value, true);
  store.save(); recompute();
});
$('set-wake').addEventListener('change', (e) => {
  store.get().settings.wakeMin = inputToMin(e.target.value, false);
  store.save(); recompute();
});
$('set-session').addEventListener('change', (e) => {
  const min = Math.round(Number(e.target.value));
  if (min >= 1 && min <= 120) store.get().settings.sessionMin = min;
  store.save(); render();
});
$('set-name').addEventListener('change', (e) => {
  store.get().settings.name = e.target.value.trim() || 'Pip';
  store.save(); render();
});

$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
  a.download = `vaper-taper-backup-${dateKey(Date.now())}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});
$('import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    store.importJson(await file.text());
    toast('Backup imported.');
    recompute();
  } catch (err) {
    toast(`Couldn't import: ${err.message}`);
  }
  e.target.value = '';
});
$('reset').addEventListener('click', () => {
  if (!confirm('Forget every puff, achievement and item on this device? The Vaper Taper keeps its own copy of recent puffs.')) return;
  store.reset();
  recompute();
});
$('evolve-ok').addEventListener('click', () => $('evolve-dialog').close());

// ---------- Start ----------

recompute();
renderBattery();
if (location.hash) showView(location.hash.slice(1));
setInterval(renderTicker, 1000);
setInterval(recompute, MIN);
setInterval(() => { if (device.state === 'connected') device.syncTime().catch(() => {}); }, 60 * MIN);

if (!supported) {
  $('unsupported').hidden = false;
  $('connect').disabled = true;
} else {
  device.reconnectKnown().catch((e) => console.warn('No auto-reconnect:', e.message));
}

// The Windows app calls this every 30 s. It picks the device itself, so
// there's no picker.
window.vaperTaperAutoConnect = () => {
  if (!supported || device.wanted || device.state !== 'disconnected') return;
  device.choose().catch(() => {});
};

if (!isDesktop && 'serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
