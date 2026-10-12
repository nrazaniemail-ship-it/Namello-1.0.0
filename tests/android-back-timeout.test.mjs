import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
const app = await readFile('index.html', 'utf8');

test('Android Back has a timeout fallback if WebView JavaScript callback stalls', () => {
  assert.match(native, /backHandler\.postDelayed\(timeout, 800L\)/);
  assert.match(native, /backHandler\.removeCallbacks\(timeout\)/);
  assert.match(native, /completeBackDecision\("exit"\)/);
});

test('Android Back avoids overlapping async decisions and retains double-press exit behavior', () => {
  assert.match(native, /if \(backDecisionPending\) return/);
  assert.match(native, /private void completeBackDecision\(String result\)/);
  assert.match(native, /now - lastBackPressAt < 1800L/);
  assert.match(native, /برای خروج، دوباره دکمه‌ی بازگشت را بزنید/);
  assert.match(app, /window\.__nmNativeBack = \(\) =>/);
});


test('a Back press handled by a dialog resets the main-page double-Back exit timer', () => {
  assert.match(native, /if \(result != null && result\.contains\("handled"\)\) \{[\s\S]*?lastBackPressAt = 0L;[\s\S]*?return;/);
});
