// Turns the puff log into streaks, nights, XP, levels and achievements.
// Pure functions, so they can be tested with `node --test app/tests`.
//
// Time asleep doesn't count as time without vaping. Each night runs from a
// bedtime to a wake time (01:00 to 08:00 unless changed). A night is keyed by
// the date of the morning it ends on, and bedtime is stored as minutes from
// that morning's midnight, so 23:30 the evening before is -30.

const MIN = 60000;
const DAY = 86400000;

export const DEFAULT_SETTINGS = { bedMin: 60, wakeMin: 480 };

export function dateKey(ms) {
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function atMinutes(key, minutes) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 0, minutes).getTime();  // handles negative minutes and DST
}

export function shiftKey(key, days) {
  const [y, m, d] = key.split('-').map(Number);
  return dateKey(new Date(y, m - 1, d + days, 12).getTime());
}

export function nightTimes(key, settings, overrides) {
  const o = (overrides && overrides[key]) || {};
  const bed = o.bedMin ?? settings.bedMin;
  const wake = o.wakeMin ?? settings.wakeMin;
  return { bedMin: bed, wakeMin: wake };
}

export function nightWindow(key, settings, overrides) {
  const { bedMin, wakeMin } = nightTimes(key, settings, overrides);
  return { key, start: atMinutes(key, bedMin), end: atMinutes(key, wakeMin) };
}

// The night (if any) that contains time t.
export function nightAt(t, settings, overrides) {
  for (const k of [dateKey(t), shiftKey(dateKey(t), 1)]) {
    const w = nightWindow(k, settings, overrides);
    if (t >= w.start && t < w.end) return w;
  }
  return null;
}

// Milliseconds between a and b that fall outside nights.
export function awakeMs(a, b, settings, overrides) {
  if (b <= a) return 0;
  let asleep = 0;
  for (let k = shiftKey(dateKey(a), -1), last = shiftKey(dateKey(b), 1); k <= last; k = shiftKey(k, 1)) {
    const w = nightWindow(k, settings, overrides);
    asleep += Math.max(0, Math.min(b, w.end) - Math.max(a, w.start));
  }
  return b - a - asleep;
}

// ---- XP and levels ----

// XP for a gap between puffs, by awake minutes. It grows with the square of the
// gap up to 4 hours (1 hour = 60 XP, 2 hours = 240 XP), then 8 XP a minute.
export function gapXp(minutes) {
  if (minutes <= 240) return (minutes * minutes) / 60;
  return 960 + 8 * (minutes - 240);
}

export const CLEAN_NIGHT_XP = 150;

export function xpForLevel(level) {
  return Math.round(300 * Math.pow(level - 1, 1.6));
}

export function levelInfo(xp) {
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const from = xpForLevel(level), to = xpForLevel(level + 1);
  return { level, from, to, progress: (xp - from) / (to - from) };
}

// ---- Achievements ----

const hourGoals = [0.5, ...Array.from({ length: 16 }, (_, i) => i + 1)];

export const ACHIEVEMENTS = [
  ...hourGoals.map((h) => ({
    id: `gap_${h * 60}m`,
    title: h < 1 ? '30 minutes vape-free' : `${h} hour${h > 1 ? 's' : ''} vape-free`,
    detail: `Go ${h < 1 ? '30 minutes' : `${h} awake hour${h > 1 ? 's' : ''}`} without vaping.`,
    coins: Math.max(3, Math.round(h * 5)),
    test: (s) => s.longestGapMs >= h * 3600000,
  })),
  ...[
    [1, 'A whole day', 'Get through a whole day, wake to bedtime, without vaping.'],
    [2, 'Two whole days', 'Two days in a row with no vaping, nights included.'],
    [3, 'Three whole days', 'Three days in a row with no vaping, nights included.'],
    [5, 'Five whole days', 'Five days in a row with no vaping, nights included.'],
    [7, 'A whole week', 'Seven days in a row with no vaping, nights included.'],
    [14, 'Two weeks', 'Fourteen days in a row with no vaping, nights included.'],
    [30, 'A whole month', 'Thirty days in a row with no vaping, nights included.'],
  ].map(([d, title, detail]) => ({
    id: `day_${d}`, title, detail, coins: 100 * d,
    test: (s) => s.bestCleanDays >= d,
  })),
  ...[
    [1, 'Slept clean', 'A night with no vaping.'],
    [3, 'Three clean nights', 'Three nights in a row with no vaping.'],
    [7, 'A clean week of nights', 'Seven nights in a row with no vaping.'],
  ].map(([n, title, detail]) => ({
    id: `night_${n}`, title, detail, coins: [30, 100, 250][[1, 3, 7].indexOf(n)],
    test: (s) => s.bestCleanNights >= n,
  })),
];

// ---- Everything at once ----

// puffTimes: sorted puff start times (ms). startedAt: when logging began.
// asOf: the time the data is known to be complete up to.
export function computeStats({ puffTimes, startedAt, asOf, settings, overrides }) {
  settings = { ...DEFAULT_SETTINGS, ...settings };
  const aw = (a, b) => awakeMs(a, b, settings, overrides);
  const times = puffTimes.filter((t) => t <= asOf);
  const start = Math.min(startedAt, times.length ? times[0] : startedAt);

  // Gaps between puffs, in awake time.
  let xp = 0, longestGapMs = 0, prev = start;
  for (const t of times) {
    const g = aw(prev, t);
    xp += gapXp(g / MIN);
    if (g > longestGapMs) longestGapMs = g;
    prev = t;
  }
  const lastPuff = times.length ? times[times.length - 1] : null;
  const currentGapMs = aw(prev, asOf);
  xp += gapXp(currentGapMs / MIN);
  longestGapMs = Math.max(longestGapMs, currentGapMs);

  // Nights and days, oldest first. Day D runs from the end of night D to the
  // start of night D+1.
  const nights = [], days = [];
  let i = 0;
  for (let k = dateKey(start); ; k = shiftKey(k, 1)) {
    const night = nightWindow(k, settings, overrides);
    if (night.start > asOf) break;
    const dayEnd = nightWindow(shiftKey(k, 1), settings, overrides).start;

    while (i < times.length && times[i] < night.start) i++;
    let nightPuffs = 0;
    while (i < times.length && times[i] < night.end) { nightPuffs++; i++; }
    let dayPuffs = 0;
    let j = i;
    while (j < times.length && times[j] < dayEnd) { dayPuffs++; j++; }

    nights.push({
      ...night, puffs: nightPuffs,
      complete: night.end <= asOf, counted: night.start >= start,
    });
    days.push({
      key: k, start: night.end, end: dayEnd, puffs: dayPuffs,
      complete: dayEnd <= asOf, counted: night.end >= start,
    });
  }

  // Runs of clean nights, and of clean whole days with clean nights between.
  let cleanNights = 0, nightRun = 0, bestCleanNights = 0;
  let dayRun = 0, bestCleanDays = 0;
  for (let n = 0; n < nights.length; n++) {
    const night = nights[n], day = days[n];
    if (night.complete && night.counted) {
      if (night.puffs === 0) { cleanNights++; nightRun++; } else { nightRun = 0; }
      bestCleanNights = Math.max(bestCleanNights, nightRun);
    }
    if (night.puffs > 0) dayRun = 0;
    if (day.complete && day.counted) {
      dayRun = day.puffs === 0 ? dayRun + 1 : 0;
      bestCleanDays = Math.max(bestCleanDays, dayRun);
    } else if (day.puffs > 0) {
      dayRun = 0;
    }
  }
  xp += cleanNights * CLEAN_NIGHT_XP;
  xp = Math.floor(xp);

  return {
    xp, ...levelInfo(xp),
    lastPuff, currentGapMs, longestGapMs,
    nights, days, cleanNights, bestCleanNights, bestCleanDays,
    nightNow: nightAt(asOf, settings, overrides),
  };
}

export function nextAchievement(unlocked) {
  return ACHIEVEMENTS.find((a) => !unlocked[a.id]) || null;
}
