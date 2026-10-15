import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser news alarm warns 30 seconds before the event', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /const LEAD_MS = nmTextNotifNum\("newsLeadSec"\) \* 1000;/);
  assert.match(html, /ثانیه تا خبر/);
  assert.match(html, /newsLeadSec: 30/);
  assert.doesNotMatch(html, /const LEAD_MS = 5 \* 60 \* 1000;/);
});
