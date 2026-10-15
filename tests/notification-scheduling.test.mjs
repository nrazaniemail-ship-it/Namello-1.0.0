import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('index.html', 'utf8');
const bridge = await readFile('native-bridge.js', 'utf8');

function grab(src, re) { const m = src.match(re); assert.ok(m, 'missing: ' + re); return m[0]; }

test('news alarm: user choice wins, otherwise every news alarm is armed by default', () => {
  const fn = grab(app, /function nmNewsAlarmOn\(ev\) \{[^\n]*\}/);
  const f = new Function(fn + '; return nmNewsAlarmOn;')();
  assert.equal(f({ impact: 'high' }), true);
  assert.equal(f({ impact: 'high', alarmStart: false }), true, 'legacy default false does not disable high impact');
  assert.equal(f({ impact: 'medium' }), true, 'all news armed by default');
  assert.equal(f({ impact: 'medium', alarmStart: false, alarmUser: true }), false);
  assert.equal(f({ impact: 'medium', alarmStart: true }), true);
  assert.equal(f({ impact: 'high', alarmStart: false, alarmUser: true }), false, 'explicit user choice is respected');
  assert.equal(f({ impact: 'medium', alarmStart: true, alarmUser: true }), true);
  assert.equal(f(null), false);
  // the same rule exists in the Android bridge
  const bf = new Function(grab(bridge, /function newsAlarmOn\(ev\) \{[^\n]*\}/) + '; return newsAlarmOn;')();
  for (const ev of [{ impact: 'high' }, { impact: 'medium' }, { impact: 'high', alarmUser: true, alarmStart: false }, { impact: 'medium', alarmStart: true }]) assert.equal(bf(ev), f(ev));
});

test('refreshing live news keeps the alarms the user chose and the alarm effect uses the shared rule', () => {
  assert.match(app, /return o && o\.alarmUser \? \{ \.\.\.e, alarmStart: o\.alarmStart, alarmUser: true \} : e;/);
  assert.match(app, /if \(!nmNewsAlarmOn\(ev\) \|\| fired\[ev\.id\]\)/);
  assert.match(app, /alarmStart: !nmNewsAlarmOn\(e\), alarmUser: true/);
});

test('recommendation notifications are scheduled globally at random intervals, not only when a page is open', () => {
  assert.match(app, /function NmRecommendationNotificationScheduler\(\{ trades, psychOptions \}\)/);
  assert.match(app, /RE\(NmRecommendationNotificationScheduler, \{ trades, psychOptions \}\)/);
  assert.match(app, /function nmRecRandomInterval\(category\) \{ const base = nmTextNotifNum/);
  assert.match(app, /namello_text_notif_reco_pool_v1/);
});

test('native bridge pre-schedules deterministic random recommendation notifications in waking hours', () => {
  const code = [grab(bridge, /function recHash\(n\) \{[^\n]*\}/), grab(bridge, /function planRecommendations\(now, out\) \{[\s\S]*?\n  \}\n/)].join('\n');
  const mk = (pool) => new Function('readLocalJson', 'HORIZON_MS', 'KEY_REC_POOL', 'REC_TITLES', 'prefNum', code + '; return planRecommendations;');
  const REC_TITLES = { evaluation: 'E', psychology: 'P' };
  const pool = { evaluation: ['a', 'b', 'c'], psychology: ['x'] };
  const plan = mk(pool)(() => pool, 36 * 3600e3, 'k', REC_TITLES, (k, d) => d);
  const now = Date.UTC(2026, 9, 15, 6, 0, 0);
  const run = () => { const out = []; plan(now, out); return out; };
  const a = run(), b = run();
  assert.ok(a.length >= 6, 'several notifications are planned');
  assert.deepEqual(a, b, 'plan is stable between syncs');
  for (const it of a) {
    assert.ok(it.at > now && it.at < now + 36 * 3600e3);
    const h = new Date(it.at).getHours();
    assert.ok(h >= 8 && h < 22, 'no night notifications');
    assert.ok(['evaluation', 'psychology'].includes(it.kind));
  }
  const none = []; mk({})(() => ({ evaluation: [], psychology: [] }), 36 * 3600e3, 'k', REC_TITLES, (k, d) => d)(now, none);
  assert.equal(none.length, 0);
  assert.match(bridge, /item\.kind === 'evaluation' \|\| item\.kind === 'psychology'/);
});

test('settings box can request notification permission and switches motivation on', () => {
  assert.match(app, /const askPermission = async \(\) =>/);
  assert.match(app, /const enableMotivation = async \(\) =>/);
  assert.match(app, /فعال‌سازی مجوز اعلان/);
});
