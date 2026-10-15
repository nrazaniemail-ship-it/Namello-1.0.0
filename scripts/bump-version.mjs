#!/usr/bin/env node
/*
 * Namello – one command to change the app version everywhere.
 *
 *   node scripts/bump-version.mjs 1.0.35          (versionCode = current + 1)
 *   node scripts/bump-version.mjs 1.0.35 36       (explicit versionCode)
 *
 * version.json is the single source of truth. This script rewrites every file that carries the
 * version, so scripts/verify-namello-version.mjs, the tests and the APK build can never drift apart
 * again (a hard-coded version in a test or in the verifier was the classic reason for a red build).
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next || "")) {
  console.error("usage: node scripts/bump-version.mjs <major.minor.patch> [versionCode]");
  process.exit(2);
}
const current = JSON.parse(await readFile("version.json", "utf8"));
const nextCode = process.argv[3] ? Number(process.argv[3]) : Number(current.versionCode) + 1;
if (!Number.isInteger(nextCode) || nextCode < 1) {
  console.error("versionCode must be a positive integer");
  process.exit(2);
}
const oldV = current.version;
const oldC = Number(current.versionCode);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let touched = 0;
async function edit(file, fn, { required = true } = {}) {
  if (!existsSync(file)) {
    if (required) throw new Error(`Missing file: ${file}`);
    return;
  }
  const before = await readFile(file, "utf8");
  const after = fn(before);
  if (after === before && before.includes(next)) return; // already up to date
  if (after === before) throw new Error(`${file}: nothing to replace (version markers not found)`);
  await writeFile(file, after);
  touched++;
  console.log(`updated ${file}`);
}

await writeFile("version.json", JSON.stringify({ version: next, versionCode: nextCode }, null, 2) + "\n");
console.log(`updated version.json  ${oldV}/${oldC} -> ${next}/${nextCode}`);

// public/version.json is served directly by the PWA; keep it aligned with the source of truth.
await writeFile("public/version.json", JSON.stringify({ version: next, versionCode: nextCode }, null, 2) + "\n");
console.log("updated public/version.json");

await edit("package.json", (t) => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`));

for (const f of ["index.html"]) {
  await edit(f, (t) => t
    .replace(/<title>Namello [^<]*<\/title>/, `<title>Namello ${next}</title>`)
    .replace(/Loading Namello [0-9.]+…/, `Loading Namello ${next}…`)
    .replace(/(const NM_VERSION_NAME = ")[^"]*(";)/, `$1${next}$2`)
    .replace(/(const NM_VERSION_CODE = )\d+(;)/, `$1${nextCode}$2`));
}
// Legacy mirrors of the inline script used by the contract tests
for (const f of ["index_scripts/16.js", "public/index_scripts/16.js"]) {
  await edit(f, (t) => t
    .replace(/(const NM_VERSION_NAME = ")[^"]*(";)/, `$1${next}$2`)
    .replace(/(const NM_VERSION_CODE = )\d+(;)/, `$1${nextCode}$2`), { required: false });
}

const manifests = ["manifest.json", "manifest-midnight.json", "manifest-emerald.json", "manifest-royal.json",
  "manifest-graphite.json", "manifest-sunset.json", "manifest-ruby.json"];
for (const dir of ["", "public/"]) {
  for (const m of manifests) {
    await edit(dir + m, (t) => t
      .replace(/("name"\s*:\s*"Namello )[^"]*(")/, `$1${next}$2`)
      .replace(/("short_name"\s*:\s*"Namello )[^"]*(")/, `$1${next}$2`)
      .replace(/("version"\s*:\s*")[^"]*(")/, `$1${next}$2`)
      .replace(/("versionCode"\s*:\s*)\d+/, `$1${nextCode}`));
  }
  await edit(dir + "sw.js", (t) => t
    .replace(/const CACHE_NAME = "namello-[^"]*";/, `const CACHE_NAME = "namello-${next}-c${nextCode}";`)
    .replace(/\(Namello [0-9.]+ \/ Version Code \d+\)/, `(Namello ${next} / Version Code ${nextCode})`));
}

await edit("backend/package.json", (t) => t.replace(/("version"\s*:\s*")[^"]+(")/, `$1${next}$2`), { required: false });
await edit("backend/server.mjs", (t) => t.replace(/(service: 'namello-sync', version: ')[^']*(')/, `$1${next}$2`), { required: false });
await edit("CHANGELOG.md", (t) => /^# Namello [0-9.]+ — Version Code \d+/.test(t) ? t.replace(/^# Namello [0-9.]+ — Version Code \d+/, `# Namello ${next} — Version Code ${nextCode}`) : `# Namello ${next} — Version Code ${nextCode}\n\n` + t, { required: false });
await edit("README.md", (t) => t.replace(/^# Namello [0-9.]+/m, `# Namello ${next}`), { required: false });

console.log(`\nDone (${touched} files changed). Remember to add the release notes to NM_CHANGELOG in index.html,`);
console.log("then run: node scripts/verify-namello-version.mjs && npm test");
void oldC; void escapeRe;
