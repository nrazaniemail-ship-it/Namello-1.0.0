import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

test('Android backup folder selection uses the native SAF picker when browser directory APIs are unavailable', () => {
  assert.match(html, /async function nmBkPickManualFolder\(\)[\s\S]{0,600}if \(caps\.native\)[\s\S]{0,180}nmBkNativePickFolder\(\)/);
  assert.match(html, /async function nmBkPickAutoTarget\(\)[\s\S]{0,400}if \(caps\.native\)[\s\S]{0,200}nmBkNativePickFolder\(\)/);
  assert.match(html, /\(caps\.dir \|\| caps\.native\) && RE\("button"[\s\S]{0,220}"انتخاب پوشه"/);
  assert.match(html, /meta\.autoKind === "native-picked"/);
});

test('quick-launch controls are disabled by default and appear on the right edge', () => {
  assert.match(html, /mt5Enabled: false/);
  assert.match(html, /tvEnabled: false/);
  assert.match(html, /defaultCorner: "bottom-right"/);
  assert.match(html, /title:"اجرای سریع MT5\/TradingView"/);
});

test('session clock is larger and has a thicker session ring with more legible labels', () => {
  assert.match(html, /max-w-\[380px\]/);
  assert.match(html, /const size = 380, cx = size \/ 2, cy = size \/ 2;/);
  assert.match(html, /const sessR = 133, sessW = 28;/);
  assert.match(html, /lp = polar\(cx, cy, 201, a\)/);
  assert.match(html, /fontSize: major \? 21 : 18/);
  assert.match(html, /fontSize: "10", fontWeight: "700"/);
});

test('custom trade-field manager is not in global Settings and is inside Journal account settings', () => {
  const managerAt = html.indexOf('RE(NmCustomFieldsManager, { getLists: getJournalLists, applyLists: applyJournalLists })');
  const settingsArea = html.indexOf('RE(NmCollapsible, { title: "امنیت، پشتیبان، ذخیره ابری و Namello Backend"');
  const journalSettings = html.indexOf('showAccSettings && (React.createElement("div"');
  assert.notEqual(managerAt, -1);
  assert.ok(managerAt > journalSettings, 'manager belongs to Journal account settings');
  assert.ok(managerAt > settingsArea, 'manager must not be rendered in the global Settings layer');
  assert.match(html.slice(managerAt, managerAt + 100), /RE\(NmCustomFieldsManager, \{ getLists/);
  assert.match(html, /فرم فعال ژورنال/);
  assert.match(html, /ثبت ورود/);
  assert.match(html, /ثبت نتیجه معامله/);
});
