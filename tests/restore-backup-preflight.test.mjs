import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const app = await readFile('index.html', 'utf8');

test('backup parser rejects foreign/empty structured backups before restore can replace app data', () => {
  const start = app.indexOf('function nmBkParse(text) {');
  const end = app.indexOf('function nmMergeVal(', start);
  assert.ok(start >= 0 && end > start);
  const parser = app.slice(start, end);
  assert.match(parser, /!Array\.isArray\(obj\.data\)/);
  assert.match(parser, /empty-or-foreign-backup/);
  assert.match(parser, /keys\.length/);
});

test('restore no longer contains a duplicate unreachable success return', () => {
  const start = app.indexOf('async function nmBkApply(payload, mode) {');
  const end = app.indexOf('function NmRestoreDialog(', start);
  const fn = app.slice(start, end);
  assert.equal((fn.match(/return \{ count: Object\.keys\(incoming\)\.length, failed: 0 \};/g) || []).length, 1);
});


test('restore aborts before mutating data when pre-restore snapshot cannot be saved', () => {
  const start = app.indexOf('async function nmBkApply(payload, mode) {');
  const end = app.indexOf('function NmRestoreDialog(', start);
  const fn = app.slice(start, end);
  const snapshot = fn.indexOf('await nmIdbSet("preRestore"');
  const abort = fn.indexOf('restore-aborted-snapshot-failed');
  const mutation = fn.indexOf('await window.storage.delete(k)');
  assert.ok(snapshot >= 0 && abort > snapshot && mutation > abort);
  assert.match(fn, /catch \(e\) \{\s*throw new Error\("restore-aborted-snapshot-failed"\);\s*\}/);
});


test('restore apply validates payload itself before reading snapshot or mutating storage', () => {
  const start = app.indexOf('async function nmBkApply(payload, mode) {');
  const end = app.indexOf('function NmRestoreDialog(', start);
  const fn = app.slice(start, end);
  const validation = fn.indexOf('invalid-backup-payload');
  const empty = fn.indexOf('empty-or-foreign-backup');
  const snapshot = fn.indexOf('await nmIdbSet("preRestore"');
  const mutation = fn.indexOf('await window.storage.delete(k)');
  assert.ok(validation >= 0 && empty > validation);
  assert.ok(snapshot > empty && mutation > snapshot);
  assert.match(fn, /payload\.app !== "Namello"/);
  assert.match(fn, /Array\.isArray\(payload\.data\)/);
});
