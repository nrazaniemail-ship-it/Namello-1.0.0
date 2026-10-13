import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('PWA registers Service Worker with explicit subpath scope and handles registration rejection', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /navigator\.serviceWorker\.register\(swUrl\.href,\s*\{\s*scope:\s*swScope\s*\}\)/);
  assert.match(html, /new URL\('\.\/sw\.js', window\.location\.href\)/);
  assert.match(html, /new URL\('\.\/', window\.location\.href\)\.pathname/);
  assert.match(html, /register\(swUrl\.href,\s*\{\s*scope:\s*swScope\s*\}\)\.catch\(function \(err\)/);
  assert.doesNotMatch(html, /navigator\.serviceWorker\.getRegistration\(\)\.then\(function\s*\(r\)\s*\{\s*if\s*\(r\)\s*r\.update\(\)/);
});
