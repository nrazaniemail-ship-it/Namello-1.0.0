#!/usr/bin/env node
/*
 * Namello – release consistency check (first step in CI; locally: `npm run verify`).
 *
 * version.json is the ONLY place that defines the expected version; nothing is hard-coded here.
 * The script collects *every* problem and prints them all at once, so one failed CI run shows
 * everything that must be fixed (instead of one error per run).
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const errors = [];
const warnings = [];
const fail = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

async function text(file) {
  try { return await readFile(file, "utf8"); } catch { fail(`missing file: ${file}`); return ""; }
}
async function json(file) {
  const t = await text(file);
  if (!t) return null;
  try { return JSON.parse(t); } catch (e) { fail(`${file} is not valid JSON: ${e.message}`); return null; }
}
const sameBytes = async (a, b) => {
  try { return Buffer.compare(await readFile(a), await readFile(b)) === 0; } catch { return false; }
};

let V = "?";
let C = "?";
function report() {
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length) {
    console.error(`\nNamello verification FAILED (${errors.length} problem${errors.length > 1 ? "s" : ""}):`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  console.log(`Namello verified: ${V} (versionCode ${C}) – ${warnings.length} warning(s), 0 errors`);
  process.exit(0);
}

/* ---------------------------------------------------------------- version.json */
const version = await json("version.json");
if (!version) report();
V = version.version;
C = version.versionCode;
if (!/^\d+\.\d+\.\d+$/.test(V || "")) fail(`version.json: "version" must look like 1.2.3 (got ${JSON.stringify(V)})`);
if (!Number.isInteger(C) || C < 1) fail(`version.json: "versionCode" must be a positive integer (got ${JSON.stringify(C)})`);

/* ---------------------------------------------------------------- public version mirror */
const publicVersion = await json("public/version.json");
if (publicVersion && (publicVersion.version !== V || publicVersion.versionCode !== C)) {
  fail(`public/version.json (${publicVersion.version}/code ${publicVersion.versionCode}) != version.json (${V}/code ${C}); run scripts/bump-version.mjs ${V} ${C}`);
}

/* ---------------------------------------------------------------- package.json */
const pkg = await json("package.json");
if (pkg) {
  if (pkg.version !== V) fail(`package.json version ${pkg.version} != version.json ${V}`);
  for (const s of ["build", "test", "typecheck", "verify"]) {
    if (!pkg.scripts || !pkg.scripts[s]) fail(`package.json: missing npm script "${s}"`);
  }
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  for (const d of ["@capacitor/core", "@capacitor/android", "@capacitor/cli", "@capacitor/local-notifications",
    "@capacitor/filesystem", "@capacitor/share", "typescript"]) {
    if (!all[d]) fail(`package.json: missing dependency ${d}`);
  }
  const majors = new Set(Object.entries(all).filter(([k]) => k.startsWith("@capacitor/"))
    .map(([, v]) => (String(v).match(/\d+/) || ["?"])[0]));
  if (majors.size > 1) fail(`package.json: @capacitor/* packages must share one major version (found ${[...majors].join(", ")})`);
}

/* ---------------------------------------------------------------- backend + docs */
const backendPkg = await json("backend/package.json");
if (backendPkg && backendPkg.version !== V) fail(`backend/package.json version ${backendPkg.version} != ${V}`);
const backendSrv = existsSync("backend/server.mjs") ? await text("backend/server.mjs") : "";
if (backendSrv && !backendSrv.includes(`version: '${V}'`)) fail(`backend/server.mjs /healthz version is not ${V}`);
const changelogMd = existsSync("CHANGELOG.md") ? await text("CHANGELOG.md") : "";
if (changelogMd && !changelogMd.startsWith(`# Namello ${V} — Version Code ${C}`)) fail(`CHANGELOG.md must start with "# Namello ${V} — Version Code ${C}"`);
const readmeMd = existsSync("README.md") ? await text("README.md") : "";
if (readmeMd && !/^# Namello (\d+\.\d+\.\d+)/m.test(readmeMd)) warn("README.md has no version heading");
else if (readmeMd && !readmeMd.startsWith(`# Namello ${V}`)) fail(`README.md heading is not "# Namello ${V}"`);

/* ---------------------------------------------------------------- index.html */
const index = await text("index.html");
if (index) {
  if (!index.includes(`<title>Namello ${V}</title>`)) fail(`index.html <title> is not "Namello ${V}"`);
  if (!index.includes(`const NM_VERSION_NAME = "${V}";`)) fail(`index.html NM_VERSION_NAME is not "${V}"`);
  if (!index.includes(`const NM_VERSION_CODE = ${C};`)) fail(`index.html NM_VERSION_CODE is not ${C}`);
  if (!index.includes(`Loading Namello ${V}`)) warn(`index.html boot text does not mention ${V}`);
  if (!/<script src="\.\/native-bridge\.js"><\/script>/.test(index)) fail("index.html does not load ./native-bridge.js");
  if (!index.includes("window.__nmNativeBack")) fail("index.html is missing window.__nmNativeBack (Android Back-button handler)");
  const changelog = index.match(/const NM_CHANGELOG = \[([\s\S]*?)\];/);
  if (!changelog) fail("index.html: NM_CHANGELOG not found");
  else if (!changelog[1].includes(`نسخه ${V}`)) warn(`NM_CHANGELOG has no entry for ${V}`);
}
for (const f of ["index_scripts/16.js", "public/index_scripts/16.js"]) {
  if (!existsSync(f)) continue;
  const t = await text(f);
  if (!t.includes(`const NM_VERSION_NAME = "${V}";`) || !t.includes(`const NM_VERSION_CODE = ${C};`)) {
    fail(`${f} still has an old NM_VERSION_NAME/CODE (run: node scripts/bump-version.mjs ${V} ${C})`);
  }
}

/* ---------------------------------------------------------------- PWA files (root + public must match) */
const manifests = ["manifest.json", "manifest-midnight.json", "manifest-emerald.json", "manifest-royal.json",
  "manifest-graphite.json", "manifest-sunset.json", "manifest-ruby.json"];
for (const dir of ["", "public/"]) {
  for (const f of manifests) {
    const m = await json(dir + f);
    if (!m) continue;
    if (m.name !== `Namello ${V}` || m.short_name !== `Namello ${V}`) fail(`${dir}${f}: name/short_name is not "Namello ${V}"`);
    if (m.versionCode !== undefined && m.versionCode !== C) fail(`${dir}${f}: versionCode ${m.versionCode} != ${C}`);
    if (m.version !== undefined && m.version !== V) fail(`${dir}${f}: version ${m.version} != ${V}`);
  }
  const sw = await text(dir + "sw.js");
  if (!sw.includes(`const CACHE_NAME = "namello-${V}-c${C}";`)) fail(`${dir}sw.js: CACHE_NAME is not namello-${V}-c${C}`);
}
for (const f of [...manifests, "sw.js", "widget.html", "native-bridge.js", "icon-192.png", "icon-512.png",
  "icon-dashboard-logo.png", "icon-sessions.png", "icon-journal.png", "icon-mt5.jpg", "icon-tradingview.png",
  ...["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map((d) => `icon-day-${d}.jpg`)]) {
  if (!existsSync(f)) { fail(`missing root file: ${f}`); continue; }
  if (!existsSync("public/" + f)) { fail(`missing public/${f} (it is what ends up in dist/)`); continue; }
  if (!(await sameBytes(f, "public/" + f))) fail(`public/${f} differs from ${f} – keep both copies identical`);
}

/* ---------------------------------------------------------------- Android build inputs */
const cap = await text("capacitor.config.ts");
if (cap) {
  if (!/appId:\s*"[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+"/i.test(cap)) fail("capacitor.config.ts: appId missing/invalid");
  if (!/webDir:\s*"dist"/.test(cap)) fail('capacitor.config.ts: webDir must be "dist"');
}
for (const f of ["assets/icon-only.png", "native/android/MainActivity.java.tpl", "native/android/FloatingReturnService.java.tpl", "native/android/IconThemeHelper.java.tpl", "native/android/DailyIconReceiver.java.tpl", "native/android/ic_stat_namello.xml",
  "scripts/build-web.mjs", "scripts/configure-android.mjs"]) {
  if (!existsSync(f)) fail(`missing build input: ${f}`);
}
const tpl = existsSync("native/android/MainActivity.java.tpl") ? await text("native/android/MainActivity.java.tpl") : "";
if (tpl && !tpl.includes("__PACKAGE__")) fail("MainActivity.java.tpl lost its __PACKAGE__ placeholder");
if (tpl && !tpl.includes("WindowInsetsCompat.CONSUMED")) fail("MainActivity.java.tpl lost its navigation-bar inset handling");

for (const wf of [".github/workflows/android-debug-apk.yml", ".github/workflows/android-release-apk.yml"]) {
  const y = await text(wf);
  for (const m of y.matchAll(/scripts\/[\w.-]+\.mjs/g)) {
    if (!existsSync(m[0])) fail(`${wf} references ${m[0]} which does not exist`);
  }
  if (/build-tools;(?!34\.0\.0|35\.0\.0)/.test(y)) fail(`${wf}: unsupported build-tools package (use 34.0.0 / 35.0.0)`);
  if (/set-android-version/.test(y)) fail(`${wf} still references the removed scripts/set-android-version.mjs`);
  if (!/scripts\/configure-android\.mjs/.test(y)) fail(`${wf} must run scripts/configure-android.mjs`);
  if (/Namello-\d+\.\d+\.\d+/.test(y)) fail(`${wf} has a hard-coded version in an artifact name – read it from version.json`);
}

/* ---------------------------------------------------------------- tests must not pin a version */
for (const f of ["tests/llm-contract.test.mjs", "tests/adaptive-engine-contract.test.mjs",
  "tests/regime-contract.test.mjs", "tests/regime-persistence-contract.test.mjs"]) {
  if (!existsSync(f)) continue;
  const t = await text(f);
  if (/assert\.(equal|strictEqual)\(\s*v\.version\s*,\s*['"]\d/.test(t) || /NM_VERSION_NAME = \\?"\d/.test(t)) {
    fail(`${f} hard-codes a version number; it must read version.json`);
  }
}

report();
