import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = h => { const n = h.replace('#', ''); const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16)); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const vars = body => Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2]]));
const root = vars(html.match(/:root \{([^}]*)\}/)[1]);
const light = { ...root, ...vars(html.match(/html\[data-theme="light"\] \{([^}]*)\}/)[1]) };
const themes = { 'default-dark': root, 'default-light': light };
for (const m of html.matchAll(/html\[data-app-theme="(\w+)"\](:not\(\[data-theme="light"\]\)|\[data-theme="light"\]) \{([^}]*)\}/g)) {
  const [, name, kind, body] = m; const isLight = !kind.startsWith(':not');
  themes[name + (isLight ? '-light' : '-dark')] = { ...(isLight ? light : root), ...vars(body) };
}
test('16 theme combinations are present', () => assert.equal(Object.keys(themes).length, 16));
test('text and accent tokens meet WCAG AA on every surface of every theme', () => {
  for (const [name, t] of Object.entries(themes)) {
    for (const s of ['bg-page', 'bg-card', 'bg-card2']) {
      assert.ok(cr(t['text-primary'], t[s]) >= 7, `${name} primary on ${s}`);
      assert.ok(cr(t['text-secondary'], t[s]) >= 4.5, `${name} secondary on ${s}`);
      assert.ok(cr(t['text-muted'], t[s]) >= 4.5, `${name} muted on ${s}`);
      assert.ok(cr(t['accent-gold'], t[s]) >= 4.5, `${name} accent on ${s}`);
    }
    assert.ok(cr(t['text-secondary'], t['bg-card2']) > cr(t['text-muted'], t['bg-card2']), `${name} keeps secondary above muted`);
  }
});
test('final-save button keeps the light-yellow background override', () => {
  assert.match(html, /\.nm-unified-export-btn\.nm-final-save-btn \{ background: #FEF3C7 !important/);
  assert.match(html, /nm-unified-export-btn nm-final-save-btn/);
});
