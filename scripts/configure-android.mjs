#!/usr/bin/env node
/*
 * Namello – configures the Capacitor-generated android/ project (run after `npx cap add android`,
 * before `npx cap sync android`). Idempotent. Every step is verified; a failure stops the build with
 * a clear message instead of silently producing an APK without the fixes.
 *
 *   - versionCode / versionName from version.json
 *   - launcher icon
 *   - permissions for notifications + alarms, soft-input mode
 *   - MainActivity (edge-to-edge insets, Back button, system-bar colour)
 *   - notification small icon
 */
import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ANDROID = process.env.ANDROID_DIR || "android";
const MAIN = path.join(ANDROID, "app/src/main");
const { version, versionCode } = JSON.parse(await readFile("version.json", "utf8"));
const problems = [];
const need = (cond, msg) => { if (!cond) problems.push(msg); };

/* 1. version */
const gradleFile = path.join(ANDROID, "app/build.gradle");
let gradle = await readFile(gradleFile, "utf8");
const codeRe = /versionCode(\s*=\s*|\s+)\d+/;
const nameRe = /versionName(\s*=\s*|\s+)"[^"]*"/;
need(codeRe.test(gradle) && nameRe.test(gradle), `${gradleFile}: versionCode/versionName not found`);
gradle = gradle.replace(codeRe, (_, sep) => `versionCode${sep}${versionCode}`).replace(nameRe, (_, sep) => `versionName${sep}"${version}"`);
await writeFile(gradleFile, gradle);

/* 2. launcher icon (best effort – a missing pattern only warns) */
const manifestFile = path.join(MAIN, "AndroidManifest.xml");
let manifest = await readFile(manifestFile, "utf8");
if (existsSync("assets/icon-only.png")) {
  await mkdir(path.join(MAIN, "res/drawable-nodpi"), { recursive: true });
  await copyFile("assets/icon-only.png", path.join(MAIN, "res/drawable-nodpi/namello_launcher.png"));
  manifest = manifest
    .replace('android:icon="@mipmap/ic_launcher"', 'android:icon="@drawable/namello_launcher"')
    .replace('android:roundIcon="@mipmap/ic_launcher_round"', 'android:roundIcon="@drawable/namello_launcher"');
  if (!manifest.includes("@drawable/namello_launcher")) console.warn("warning: launcher icon attributes not found in AndroidManifest.xml");
}

/* 2b. launcher icon themes: one activity-alias per theme (switched at runtime by MainActivity) */
const THEMES = ["default", "midnight", "emerald", "royal", "graphite", "sunset", "ruby"];
const drawableOf = (t) => (t === "default" ? "namello_launcher" : `namello_launcher_${t}`);
for (const t of THEMES.filter((x) => x !== "default")) {
  const src = `icon-${t}-512.png`;
  need(existsSync(src), `missing ${src}`);
  if (existsSync(src)) await copyFile(src, path.join(MAIN, `res/drawable-nodpi/${drawableOf(t)}.png`));
}
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
for (const d of DAYS) {
  const src = `icon-day-${d}.jpg`;
  need(existsSync(src), `missing ${src}`);
  if (existsSync(src)) await copyFile(src, path.join(MAIN, `res/drawable-nodpi/namello_launcher_day_${d}.jpg`));
}
if (!manifest.includes('android:name=".LauncherDefault"')) {
  const launcherFilter = /<intent-filter>\s*<action android:name="android\.intent\.action\.MAIN"\s*\/>\s*<category android:name="android\.intent\.category\.LAUNCHER"\s*\/>\s*<\/intent-filter>/;
  need(launcherFilter.test(manifest), "AndroidManifest.xml: MainActivity LAUNCHER intent-filter not found");
  const start = manifest.indexOf('android:name=".MainActivity"');
  const end = start >= 0 ? manifest.indexOf("</activity>", start) : -1;
  need(end > 0, "AndroidManifest.xml: </activity> of MainActivity not found");
  if (end > 0 && launcherFilter.test(manifest)) {
    const head = manifest.slice(0, end).replace(launcherFilter, "");
    const aliases = THEMES.map((t) => {
      const cls = "Launcher" + t[0].toUpperCase() + t.slice(1);
      return `
        <activity-alias
            android:name=".${cls}"
            android:targetActivity=".MainActivity"
            android:enabled="${t === "default"}"
            android:exported="true"
            android:icon="@drawable/${drawableOf(t)}"
            android:roundIcon="@drawable/${drawableOf(t)}"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`;
    }).join("\n");
    const dayAliases = DAYS.map((d) => `
        <activity-alias
            android:name=".LauncherDay${d[0].toUpperCase() + d.slice(1)}"
            android:targetActivity=".MainActivity"
            android:enabled="false"
            android:exported="true"
            android:icon="@drawable/namello_launcher_day_${d}"
            android:roundIcon="@drawable/namello_launcher_day_${d}"
            android:label="@string/app_name">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity-alias>`).join("\n");
    manifest = head + "</activity>\n" + aliases + "\n" + dayAliases + manifest.slice(end + "</activity>".length);
  }
}

/* 2c. package visibility (Android 11+): needed so PackageManager can find / launch MT5 and TradingView */
if (!manifest.includes("<queries>")) {
  const queries = `    <queries>
        <package android:name="net.metaquotes.metatrader5" />
        <package android:name="com.tradingview.tradingviewapp" />
        <intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>
    </queries>
`;
  need(/<application[\s>]/.test(manifest), "AndroidManifest.xml: <application> not found");
  manifest = manifest.replace(/<application[\s>]/, (m) => `${queries}\n    ${m}`);
}

/* 3. permissions + soft input mode */
const permissions = [
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.RECEIVE_BOOT_COMPLETED",
  "android.permission.VIBRATE",
];
const missing = permissions.filter((p) => !manifest.includes(`android:name="${p}"`));
if (missing.length) {
  const lines = missing.map((p) => `    <uses-permission android:name="${p}" />`).join("\n");
  need(/<application[\s>]/.test(manifest), "AndroidManifest.xml: <application> not found");
  manifest = manifest.replace(/<application[\s>]/, (m) => `${lines}\n\n    ${m}`);
}
if (!manifest.includes("FloatingReturnService")) {
  need(manifest.includes("</application>"), "AndroidManifest.xml: </application> not found");
  manifest = manifest.replace("</application>", `
        <service
            android:name=".FloatingReturnService"
            android:exported="false" />
    </application>`);
}
if (!manifest.includes("DailyIconReceiver")) {
  need(manifest.includes("</application>"), "AndroidManifest.xml: </application> not found");
  manifest = manifest.replace("</application>", `
        <receiver
            android:name=".DailyIconReceiver"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.TIME_SET" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
            </intent-filter>
        </receiver>
    </application>`);
}
if (!/android:windowSoftInputMode=/.test(manifest)) {
  need(/android:name="\.MainActivity"/.test(manifest), "AndroidManifest.xml: .MainActivity not found");
  manifest = manifest.replace(/android:name="\.MainActivity"/, 'android:name=".MainActivity"\n            android:windowSoftInputMode="adjustResize"');
}
await writeFile(manifestFile, manifest);
need(manifest.includes('android:name=".FloatingReturnService"'), "floating-button service missing after patch");
need(manifest.includes('android:name=".DailyIconReceiver"') && manifest.includes('android:name=".LauncherDaySat"'), "weekly icon aliases/receiver missing after patch");
need(manifest.includes("<queries>") && manifest.includes("net.metaquotes.metatrader5"), "<queries> block missing after patch");
need(manifest.includes('android:name=".LauncherDefault"') && manifest.includes('android:name=".LauncherRuby"'), "launcher icon aliases missing after patch");
for (const p of permissions) need(manifest.includes(`android:name="${p}"`), `permission ${p} missing after patch`);

/* 4. MainActivity */
async function findMainActivity(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) { const r = await findMainActivity(full); if (r) return r; }
    else if (e.name === "MainActivity.java") return full;
  }
  return null;
}
const javaRoot = path.join(MAIN, "java");
const existing = existsSync(javaRoot) ? await findMainActivity(javaRoot) : null;
need(!!existing, "generated MainActivity.java not found");
if (existing) {
  const pkg = (/^\s*package\s+([\w.]+)\s*;/m.exec(await readFile(existing, "utf8")) || [])[1];
  need(!!pkg, `${existing}: package declaration not found`);
  if (pkg) {
    const tpl = await readFile("native/android/MainActivity.java.tpl", "utf8");
    await writeFile(existing, tpl.replace(/__PACKAGE__/g, pkg));
    const service = await readFile("native/android/FloatingReturnService.java.tpl", "utf8");
    await writeFile(path.join(path.dirname(existing), "FloatingReturnService.java"), service.replace(/__PACKAGE__/g, pkg));
    for (const name of ["IconThemeHelper", "DailyIconReceiver"]) {
      const tplText = await readFile(`native/android/${name}.java.tpl`, "utf8");
      await writeFile(path.join(path.dirname(existing), `${name}.java`), tplText.replace(/__PACKAGE__/g, pkg));
    }
  }
}

/* 5. notification icon */
await mkdir(path.join(MAIN, "res/drawable"), { recursive: true });
await copyFile("native/android/ic_stat_namello.xml", path.join(MAIN, "res/drawable/ic_stat_namello.xml"));

/* 5b. Category artwork shown as the large icon on Android notifications. */
const notificationArtwork = [
  ["logos/01-evaluation.png", "nm_notif_evaluation.png"],
  ["logos/02-psychology.png", "nm_notif_psychology.png"],
  ["logos/03-sessions-and-events.png", "nm_notif_sessions.png"],
  ["logos/04-news.png", "nm_notif_news.png"],
  ["logos/05-motivation.png", "nm_notif_motivation.png"],
];
await mkdir(path.join(MAIN, "res/drawable-nodpi"), { recursive: true });
for (const [src, dest] of notificationArtwork) {
  need(existsSync(src), `missing notification artwork ${src}`);
  if (existsSync(src)) await copyFile(src, path.join(MAIN, "res/drawable-nodpi", dest));
}

if (problems.length) {
  console.error("Android configuration FAILED:\n" + problems.map((p) => "  ✗ " + p).join("\n"));
  process.exit(1);
}
console.log(`Android project configured: ${version} (versionCode ${versionCode}), permissions, MainActivity, notification icon`);
