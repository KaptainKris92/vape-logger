// Everything the app remembers, kept in this browser's localStorage.
// The PC and the phone each keep their own copy. Both download the full log
// from the device, so they agree on puffs; Settings > Backup moves the rest.

const KEY = 'vaperTaper.v1';

function fresh() {
  return {
    startedAt: Date.now(),  // streaks count from here until the first puff
    puffs: [],              // [time ms, duration ms, log id, index], sorted by time
    unknownTime: 0,         // puffs saved before the device knew the time
    devices: {},            // log id -> { next: index of the next record to fetch }
    syncedAt: 0,            // when the log was last fully downloaded
    settings: { bedMin: 60, wakeMin: 480, name: 'Pip', sessionMin: 5 },
    nights: {},             // morning date -> { bedMin, wakeMin }
    achievements: {},       // id -> time unlocked
    spent: 0,
    owned: [],
    worn: {},
    seenLevel: 1,
    seenStage: 0,
  };
}

let data = load();
const seen = new Set(data.puffs.map((p) => `${p[2]}:${p[3]}`));

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved) return { ...fresh(), ...saved, settings: { ...fresh().settings, ...saved.settings } };
  } catch { /* fall through to a fresh start */ }
  return fresh();
}

export function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function get() {
  return data;
}

// records: [{ index, time (s), durationMs, flags }] from the device.
export function addRecords(logId, records) {
  let added = 0;
  for (const r of records) {
    const key = `${logId}:${r.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (r.flags & 1) { data.unknownTime++; continue; }
    data.puffs.push([r.time * 1000, r.durationMs, logId, r.index]);
    added++;
  }
  if (added) data.puffs.sort((a, b) => a[0] - b[0]);
  return added;
}

export function exportJson() {
  return JSON.stringify(data, null, 1);
}

// Merges a backup from another device: puffs are combined, and the rest
// (settings, nights, achievements, wardrobe) comes from whichever has more.
export function importJson(text) {
  const other = JSON.parse(text);
  if (!Array.isArray(other.puffs)) throw new Error('Not a Vaper Taper backup');
  for (const p of other.puffs) {
    const key = `${p[2]}:${p[3]}`;
    if (!seen.has(key)) { seen.add(key); data.puffs.push(p); }
  }
  data.puffs.sort((a, b) => a[0] - b[0]);
  data.startedAt = Math.min(data.startedAt, other.startedAt || Infinity);
  data.nights = { ...data.nights, ...other.nights };
  data.achievements = { ...other.achievements, ...data.achievements };
  for (const [id, dev] of Object.entries(other.devices || {})) {
    const mine = data.devices[id];
    if (!mine || mine.next < dev.next) data.devices[id] = dev;
  }
  if ((other.spent || 0) > data.spent) {
    data.spent = other.spent;
    data.owned = other.owned || [];
    data.worn = other.worn || {};
  }
  data.seenLevel = Math.max(data.seenLevel, other.seenLevel || 1);
  data.seenStage = Math.max(data.seenStage, other.seenStage || 0);
  save();
}

export function reset() {
  data = fresh();
  seen.clear();
  save();
}
