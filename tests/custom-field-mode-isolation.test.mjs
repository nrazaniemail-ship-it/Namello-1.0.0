import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile('index.html', 'utf8');
test('custom field profiles are applied independently to entry and result forms', () => {
  assert.match(app, /kind === "result" \? NM_CF_RESULT_MODE_KEY : NM_CF_ENTRY_MODE_KEY/);
  assert.match(app, /function NmCustomFieldsFormSection\(\{ values, onChange, kind = "entry" \}\)/);
  assert.match(app, /kind: "result"/);
  assert.match(app, /const applyJournalForm = async/);
  assert.match(app, /nmCfApplyMode\("entry", mode, chosen\)/);
  assert.match(app, /nmCfApplyMode\("result", mode, chosen\)/);
  assert.match(app, /هم‌زمان برای .*ثبت ورود.*ثبت نتیجه معامله/);
});
test('raw mode preserves trade values and custom profile mode references a named saved profile', () => {
  assert.match(app, /حالت خام فیلدهای سفارشی را از فرم پنهان می‌کند و اطلاعات قبلی را پاک نمی‌کند/);
  assert.match(app, /modeState\.mode === "custom" && modeState\.profileName/);
  assert.match(app, /Array\.isArray\(profiles\[modeState\.profileName\]\)/);
});
