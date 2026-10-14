import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile('index.html', 'utf8');
test('journal forms: exactly two modes (Namello / custom) with named custom forms', () => {
  assert.match(app, /function NmCustomFieldsFormSection\(\{ values, onChange, kind = "entry" \}\)/);
  assert.match(app, /function nmCfApplyMode\(|async function nmCfApplyMode\(/);
  assert.match(app, /nmJfCreate/);
  assert.match(app, /nmJfRename/);
  assert.match(app, /nmJfDelete/);
  assert.match(app, /nmJfActivate/);
  assert.match(app, /const journalListDefs = /);
  assert.match(app, /RE\(NmCustomFieldsManager, \{ getLists: getJournalLists, applyLists: applyJournalLists \}\)/);
});
test('custom journal form starts with emptied option lists and the raw mode is gone', () => {
  assert.match(app, /function nmJfBlank\(/);
  assert.match(app, /function nmJfBlankFields\(/);
  assert.equal(app.includes('if (mode === "raw"'), false);
  assert.match(app, /namello_journal_forms_state_v1/);
});
