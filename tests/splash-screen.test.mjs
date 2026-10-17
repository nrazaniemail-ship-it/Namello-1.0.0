import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const html = fs.readFileSync("index.html", "utf8");
test("splash screen: 2s minimum, tap to skip, never blocks boot errors, reduced-motion aware", () => {
  assert.match(html, /<div id="nm-splash"/);
  assert.match(html, /age >= 2200/);
  assert.match(html, /addEventListener\('click', close\)/);
  assert.match(html, /boot-error/);
  assert.match(html, /prefers-reduced-motion: reduce\) \{\s*#nm-splash/);
  assert.match(html, /ns_namello_splash_enabled_v1/);
  assert.ok(html.indexOf('id="nm-splash"') < html.indexOf('id="root"'));
});
test("splash plays the supplied head-turn animation as a 7x6 frame sprite (39 frames, steps timing)", () => {
  assert.match(html, /class="nm-splash-anim"/);
  assert.match(html, /@keyframes nmSplashTurn/);
  assert.match(html, /background-size: 700% 600%/);
  assert.match(html, /animation: nmSplashTurn [\d.]+s steps\(1, end\)/);
  const frames = html.match(/@keyframes nmSplashTurn \{([^}]*\{[^}]*\}\s*)+\}/)[0].match(/background-position/g).length;
  assert.equal(frames, 40);
  assert.match(html, /nm-splash-anim'\)/); // controller waits for the sprite to decode
  assert.ok(!/nm-splash-head|nm-splash-base/.test(html));
});
