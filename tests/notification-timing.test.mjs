import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const app = fs.readFileSync("index.html", "utf8");
const grab = re => { const m = app.match(re); assert.ok(m, String(re)); return m[0]; };
test("editable notification timings are clamped and have defaults", () => {
  const code = [grab(/const NM_TEXT_NOTIF_DEFAULTS = [^\n]*/), grab(/const NM_NOTIF_NUM_LIMITS = [^\n]*/), grab(/function nmTextNotifNum\(key\) \{[^\n]*\}/)].join("\n");
  const mk = stored => new Function("nmTextNotifLoadSettings", code + "; return nmTextNotifNum;")(() => ({ ...stored }));
  assert.equal(mk({})("newsLeadSec"), 30);
  assert.equal(mk({ newsLeadSec: 5 })("newsLeadSec"), 10);
  assert.equal(mk({ motivationIntervalMin: 99999 })("motivationIntervalMin"), 1440);
  assert.equal(mk({ sessionLeadMin: "x" })("sessionLeadMin"), 0);
  assert.equal(mk({ evaluationIntervalMin: 60 })("evaluationIntervalMin"), 60);
});
test("notifications are one settings box with two sub-sections; sessions layer no longer hosts the permission button", () => {
  assert.match(app, /function NmNotificationsSettings\(/);
  assert.match(app, /"اعلان‌های نشست‌ها"/);
  assert.doesNotMatch(app, /t\("live_enable_alarms"\)\)\)/);
});
test("defaults: all session alarms armed, export is A4 portrait", () => {
  assert.doesNotMatch(app, /alarmStart: false, alarmEnd: false, custom/);
  assert.doesNotMatch(app, /size: A4 landscape;\n/);
  assert.match(app, /paperSize: 9, orientation: "portrait"/);
});
