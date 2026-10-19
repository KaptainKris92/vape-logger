// Run with: node --test app/tests
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  awakeMs, computeStats, gapXp, levelInfo, nightAt, xpForLevel, ACHIEVEMENTS,
} from '../js/stats.js';

const H = 3600000;
const at = (d, h, m = 0) => new Date(2026, 5, d, h, m).getTime();  // June 2026, local time
const settings = { bedMin: 60, wakeMin: 480 };

test('sleep (01:00 to 08:00) is not counted as time without vaping', () => {
  assert.equal(awakeMs(at(10, 0), at(10, 9), settings, {}), 2 * H);
  assert.equal(awakeMs(at(10, 9), at(10, 21), settings, {}), 12 * H);
  assert.equal(awakeMs(at(10, 12), at(11, 12), settings, {}), 17 * H);
});

test('a bedtime the evening before shortens the awake time', () => {
  const overrides = { '2026-06-11': { bedMin: -60 } };  // 23:00 on the 10th
  assert.equal(awakeMs(at(10, 22), at(11, 9), settings, overrides), 2 * H);
  assert.ok(nightAt(at(10, 23, 30), settings, overrides));
  assert.equal(nightAt(at(10, 23, 30), settings, {}), null);
});

test('XP grows smoothly past four hours', () => {
  assert.equal(gapXp(60), 60);
  assert.equal(gapXp(240), 960);
  assert.equal(gapXp(241), 968);
  assert.equal(levelInfo(xpForLevel(5)).level, 5);
  assert.equal(levelInfo(xpForLevel(5) - 1).level, 4);
});

test('night puffs are counted separately and break the clean-night run', () => {
  const s = computeStats({
    puffTimes: [at(10, 12), at(11, 3), at(11, 20)],
    startedAt: at(10, 9),
    asOf: at(13, 10),
    settings, overrides: {},
  });
  const night11 = s.nights.find((n) => n.key === '2026-06-11');
  const night12 = s.nights.find((n) => n.key === '2026-06-12');
  assert.equal(night11.puffs, 1);
  assert.equal(night12.puffs, 0);
  assert.equal(s.cleanNights, 2);  // the 12th and 13th
  assert.equal(s.bestCleanNights, 2);
  assert.equal(s.nightNow, null);
  // Last puff 20:00 on the 11th; awake since: 5 h + 7 h + 17 h... up to 10:00 on the 13th.
  assert.equal(s.currentGapMs, 5 * H + 17 * H + 2 * H);
});

test('puffs after asOf are ignored and whole clean days are counted', () => {
  const s = computeStats({
    puffTimes: [at(10, 12), at(14, 12)],
    startedAt: at(10, 9),
    asOf: at(13, 12),
    settings, overrides: {},
  });
  assert.equal(s.lastPuff, at(10, 12));
  assert.equal(s.bestCleanDays, 2);  // the 11th and 12th (the 13th isn't over)
  const unlocked = ACHIEVEMENTS.filter((a) => a.test(s)).map((a) => a.id);
  assert.ok(unlocked.includes('day_2'));
  assert.ok(!unlocked.includes('day_3'));
  assert.ok(unlocked.includes('gap_960m'));
});

test('a year of heavy use is quick to process', () => {
  const puffTimes = [];
  for (let t = at(1, 9); t < at(1, 9) + 365 * 24 * H; t += 15 * 60000) puffTimes.push(t);
  const t0 = performance.now();
  computeStats({ puffTimes, startedAt: puffTimes[0], asOf: puffTimes.at(-1), settings, overrides: {} });
  assert.ok(performance.now() - t0 < 1000);
});
