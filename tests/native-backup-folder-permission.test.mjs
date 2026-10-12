import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const native = await readFile('native/android/MainActivity.java.tpl', 'utf8');

test('saved Android backup folder is only considered usable while read/write URI access persists', () => {
  const start = native.indexOf('public boolean hasPickedBackupFolder()');
  assert.notEqual(start, -1, 'native bridge should expose backup folder status');
  const end = native.indexOf('\n        }', start) + '\n        }'.length;
  const method = native.slice(start, end);
  assert.match(method, /getPersistedUriPermissions\(\)/);
  assert.match(method, /permission\.isReadPermission\(\)\s*&&\s*permission\.isWritePermission\(\)/);
  assert.match(method, /return false;/);
});

test('native folder picker requests persistable read/write access', () => {
  assert.match(native, /ACTION_OPEN_DOCUMENT_TREE/);
  assert.match(native, /FLAG_GRANT_READ_URI_PERMISSION\s*\|\s*Intent\.FLAG_GRANT_WRITE_URI_PERMISSION\s*\|\s*Intent\.FLAG_GRANT_PERSISTABLE_URI_PERMISSION/);
});

test('selecting a different backup folder releases the obsolete persisted SAF grant', () => {
  const selection = native.indexOf('String previousTreeText = backupPrefs.getString(KEY_BACKUP_TREE_URI, "")');
  assert.notEqual(selection, -1, 'folder replacement should track the previous URI');
  const release = native.indexOf('releasePersistableUriPermission(previousTree, oldFlags)', selection);
  assert.notEqual(release, -1, 'obsolete folder permission should be released');
  assert.ok(native.indexOf('!tree.toString().equals(previousTreeText)', selection) < release,
    'the currently selected folder must not have its grant released');
});
