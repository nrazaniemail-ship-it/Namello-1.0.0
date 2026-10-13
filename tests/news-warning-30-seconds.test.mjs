import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser news alarm warns 30 seconds before the event', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /const LEAD_MS = 30 \* 1000;/);
  assert.match(html, /\\u06F3\\u06F0 \\u062B\\u0627\\u0646\\u06CC\\u0647 \\u062A\\u0627 \\u062E\\u0628\\u0631/);
  assert.doesNotMatch(html, /const LEAD_MS = 5 \* 60 \* 1000;/);
});
