import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';

const bridge = await readFile('native-bridge.js', 'utf8');
const config = await readFile('scripts/configure-android.mjs', 'utf8');
const app = await readFile('index.html', 'utf8');

test('Android notifications retain category artwork assets without duplicating the logo on the right', async () => {
  for (const key of ['evaluation', 'psychology', 'sessions', 'news', 'motivation']) {
    assert.ok(bridge.includes(`nm_notif_${key}`), `notification mapping missing ${key}`);
    assert.ok(config.includes(`nm_notif_${key}.png`), `Android resource copy missing ${key}`);
  }
  for (const f of ['01-evaluation.png','02-psychology.png','03-sessions-and-events.png','04-news.png','05-motivation.png']) await access(`logos/${f}`);
  assert.doesNotMatch(bridge, /largeIcon:\s*categoryIcon/, 'avoid a second logo on the right side of Android notifications');
  assert.match(bridge, /smallIcon:\s*SMALL_ICON/);
});

test('custom field profiles are persisted and raw mode does not delete trade values', () => {
  assert.ok(app.includes('namello_custom_trade_field_profiles_v1'));
  assert.ok(app.includes('async function nmCfSaveProfile'));
  assert.ok(app.includes('async function nmCfApplyMode'));
  assert.match(app, /حالت خام فیلدهای سفارشی را از فرم پنهان می‌کند و اطلاعات قبلی را پاک نمی‌کند/);
  assert.ok(app.includes('if (mode === "raw" || !defs.length) return null;'));
});


test('Android backup folder supports listing and reading backups for restore', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  assert.ok(native.includes('listPickedBackupFiles'));
  assert.ok(native.includes('readPickedBackupFile'));
  assert.ok(app.includes('pickFromNativeFolder'));
  assert.ok(app.includes('انتخاب از پوشه‌ی پشتیبان اندروید'));
});

test('Android picked backup folder prunes old automatic backups while preserving newest files', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  assert.match(native, /public int prunePickedBackupFiles\(String prefix, int keep\)/);
  assert.match(native, /DocumentsContract\.deleteDocument/);
  assert.match(native, /DocumentsContract\.Document\.COLUMN_LAST_MODIFIED/);
  assert.match(native, /Long\.compare\(b\.optLong\(\"modifiedAt\", 0L\), a\.optLong\(\"modifiedAt\", 0L\)\)/);
  assert.match(app, /bridge\.prunePickedBackupFiles\(pruneKeepPrefix, keep \|\| 8\)/);
  assert.match(app, /نسخه 1\.0\.53: نگه‌داری فایل‌های پشتیبان خودکار/);
});


test('notification artwork selection honours structured category metadata as well as Persian titles', async () => {
  assert.match(bridge, /var structured = \[meta\.kind, meta\.category, data\.kind, data\.category, data\.type\]/);
  assert.match(bridge, /advancedevaluation/);
  assert.match(bridge, /tradingpsychology/);
  assert.match(bridge, /ارزیابیرفتاربازار/);
});

test('explicit notification category wins over conflicting words in the title/body', () => {
  const structured = bridge.indexOf('var structured = [meta.kind, meta.category, data.kind, data.category, data.type]');
  const fallback = bridge.indexOf('// Legacy callers without structured metadata are classified from visible text.');
  assert.ok(structured >= 0 && fallback > structured, 'structured category mapping must run before title/body fallback');
  const block = bridge.slice(structured, fallback);
  assert.match(block, /return 'nm_notif_evaluation'/);
  assert.match(block, /return 'nm_notif_news'/);
});


test('backup restore validates mode and attempts rollback on partial storage failure', () => {
  const start = app.indexOf('async function nmBkApply(payload, mode) {');
  const end = app.indexOf('function NmRestoreDialog(', start);
  assert.ok(start >= 0 && end > start, 'restore function boundaries exist');
  const fn = app.slice(start, end);
  assert.ok(fn.includes('invalid-restore-mode'));
  assert.ok(fn.includes('const rollback = async () =>'));
  assert.ok(fn.includes('await rollback()'));
  assert.ok(fn.includes('restore-failed; previous data restored'));
  assert.ok(fn.includes('restore-rollback-failed'));
  assert.ok(fn.includes('nmIdbSet("preRestore"'));
});


test('native backup folder callback safely quotes provider-controlled strings', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  assert.ok(native.includes('JSONObject.quote(name)'));
  assert.ok(native.includes('JSONObject.quote(tree.toString())'));
});

test('failed writes to the picked backup folder remove partial documents', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  const start = native.indexOf('public String saveToPickedBackupFolder(');
  const end = native.indexOf('public String saveToDownloads(', start);
  const fn = native.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.ok(fn.includes('try (OutputStream out = getContentResolver().openOutputStream(file, "w"))'));
  assert.ok(fn.includes('DocumentsContract.deleteDocument(getContentResolver(), file)'));
  assert.ok(fn.includes('out.flush()'));
});


test('Android restore folder resolves the actual root document and orders backups by modified time', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  assert.ok(native.includes('DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))'));
  assert.ok(native.includes('DocumentsContract.Document.COLUMN_LAST_MODIFIED'));
  assert.ok(native.includes('Long.compare(b.optLong("modifiedAt", 0), a.optLong("modifiedAt", 0))'));
});


test('Android backup folder selection requires persistent read/write grants and reports permission errors', async () => {
  const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');
  assert.ok(native.includes('folder-needs-read-write-access'));
  assert.ok(native.includes('takePersistableUriPermission(tree, flags)'));
  assert.ok(native.includes('getPersistedUriPermissions()'));
  assert.ok(native.includes("final String errorCode = failure"));
  assert.ok(app.includes('errorCode === "cancelled"'));
  assert.ok(app.includes('selected.error === "permission"'));
});
