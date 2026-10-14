import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const read = (f) => fs.readFileSync(f, "utf8");
const index = read("index.html");
const java = read("native/android/MainActivity.java.tpl");
const helper = read("native/android/IconThemeHelper.java.tpl");

test("layer-order arrows are orange", () => {
  assert.ok(index.includes('RE(ChevronUp,{size:15,color:"#F59E0B"'));
  assert.ok(index.includes('RE(ChevronDown,{size:15,color:"#F59E0B"'));
});

test("widget page has a bottom-right curved back arrow that returns to the app", () => {
  for (const f of ["widget.html", "public/widget.html"]) {
    const w = read(f);
    assert.match(w, /id="backBtn"/);
    assert.match(w, /\.back-btn\s*{[^}]*position:\s*fixed;[^}]*right:[^}]*bottom:/s);
    assert.match(w, /M20 20v-7a4 4 0 0 0-4-4H4/); // curved arrow path
    assert.match(w, /window\.__nmNativeBack\s*=/);
    assert.match(w, /location\.href\s*=\s*'\.\/index\.html'/);
  }
  assert.equal(read("widget.html"), read("public/widget.html"));
});

test("settings call the native Android hooks", () => {
  assert.match(index, /NamelloAndroid\.setLauncherIcon\(next\)/);
  assert.match(index, /NamelloAndroid\.setReturnNotification\(/);
});

test("launcher icon keys match between app and the build script", () => {
  const appKeys = [...index.match(/const NM_ICON_THEMES = \[([\s\S]*?)\n\];/)[1].matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
  const cfgKeys = [...read("scripts/configure-android.mjs").match(/const THEMES = \[([^\]]*)\]/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(cfgKeys, appKeys);
  const helperKeys = [...helper.match(/THEMES = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(helperKeys, appKeys);
  for (const k of appKeys.filter((x) => x !== "default")) assert.ok(fs.existsSync(`icon-${k}-512.png`), `icon-${k}-512.png`);
});

test("Navigation bar setting: two modes (تداخل / جدایش) wired from Settings to MainActivity", () => {
  assert.ok(java.includes("WindowInsetsCompat.CONSUMED"), "insets are consumed so nothing is padded twice");
  assert.match(java, /view\.setPadding\(bars\.left, 0, bars\.right, bottom\)/);
  assert.match(java, /separate \? Math\.max\(bars\.bottom, keyboard\.bottom\) : keyboard\.bottom/);
  assert.ok(java.includes("setNavBarMode") && java.includes("getNavBarMode") && java.includes("KEY_NAV_MODE"));
  assert.ok(index.includes("function NmNavBarModeCard"));
  assert.ok(index.includes('title: "Navigation bar"'));
  assert.ok(index.includes('title: "تداخل"') && index.includes('title: "جدایش (پیش‌فرض)"'));
  assert.ok(index.includes('RE(NmNavBarModeCard, { value: navBarMode, onChange: persistNavBarMode })'));
  assert.ok(index.includes('"ns_namello_navbar_mode_v1") === "overlap" ? "overlap" : "separate"'), "default is separate");
  assert.ok(index.includes("window.NamelloAndroid.setNavBarMode(mode)"));
  assert.ok(read("native-bridge.js").includes("namello_navbar_mode_v1"));
  assert.ok(index.includes("var(--nm-safe-top, env(safe-area-inset-top, 0px))"));
  assert.equal((java.match(/\{/g) || []).length, (java.match(/\}/g) || []).length, "balanced braces");
});

test("configure-android produces launcher aliases, permissions and MainActivity (idempotent)", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nm-android-"));
  const main = path.join(dir, "app/src/main");
  fs.mkdirSync(path.join(main, "java/com/namello/app"), { recursive: true });
  fs.writeFileSync(path.join(dir, "app/build.gradle"), 'android { defaultConfig {\n versionCode 1\n versionName "1.0"\n } }');
  fs.writeFileSync(path.join(main, "java/com/namello/app/MainActivity.java"), "package com.namello.app;\npublic class MainActivity extends com.getcapacitor.BridgeActivity {}\n");
  fs.writeFileSync(path.join(main, "AndroidManifest.xml"), `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round" android:label="@string/app_name">
        <activity android:name=".MainActivity" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
    <uses-permission android:name="android.permission.INTERNET" />
</manifest>`);
  for (let i = 0; i < 2; i++) {
    const r = spawnSync(process.execPath, ["scripts/configure-android.mjs"], { env: { ...process.env, ANDROID_DIR: dir }, encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
  }
  const m = read(path.join(main, "AndroidManifest.xml"));
  assert.equal((m.match(/<activity-alias/g) || []).length, 14, "7 fixed themes + 7 weekdays");
  assert.equal((m.match(/android:name="\.LauncherDay/g) || []).length, 7);
  assert.ok(m.includes('android:name=".DailyIconReceiver"') && m.includes("BOOT_COMPLETED"));
  for (const f of ["IconThemeHelper", "DailyIconReceiver"]) assert.ok(read(path.join(main, `java/com/namello/app/${f}.java`)).startsWith("package com.namello.app;"), f);
  assert.ok(fs.existsSync(path.join(main, "res/drawable-nodpi/namello_launcher_day_sat.jpg")));
  assert.equal((m.match(/android:enabled="true"/g) || []).length, 1);
  const act = m.slice(m.indexOf('android:name=".MainActivity"'), m.indexOf("</activity>"));
  assert.ok(!act.includes("LAUNCHER"), "MainActivity itself must not be a launcher entry");
  for (const p of ["POST_NOTIFICATIONS", "SCHEDULE_EXACT_ALARM"]) assert.ok(m.includes(p));
  assert.equal((m.match(/<queries>/g) || []).length, 1, "package-visibility block (once)");
  assert.equal((m.match(/FloatingReturnService"/g) || []).length, 1, "floating service declared once");
  assert.ok(m.includes("SYSTEM_ALERT_WINDOW"));
  assert.ok(!m.includes("FOREGROUND_SERVICE") && !m.includes("foregroundServiceType"), "plain service: no foreground-service permission / type (no notification)");
  const svc = read(path.join(main, "java/com/namello/app/FloatingReturnService.java"));
  assert.ok(svc.startsWith("package com.namello.app;") && !svc.includes("__PACKAGE__"));
  assert.ok(m.includes("net.metaquotes.metatrader5") && m.includes("com.tradingview.tradingviewapp"));
  assert.ok(read(path.join(main, "java/com/namello/app/MainActivity.java")).includes("package com.namello.app;"));
  assert.ok(fs.existsSync(path.join(main, "res/drawable-nodpi/namello_launcher_ruby.png")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("1.0.41: quick-launch buttons open installed apps through the native launcher", () => {
  assert.ok(java.includes("public String launchApp"));
  assert.ok(java.includes("getLaunchIntentForPackage"));
  assert.ok(index.includes("window.NamelloAndroid.launchApp(pkg || \"\", scheme || \"\")"));
  // the web path (intent:// chain) must still exist for the PWA
  assert.ok(index.includes("intent://#Intent;action=android.intent.action.MAIN"));
});

test("1.0.41: theme toggle is centred at the top of the page", () => {
  assert.match(index, /id: "nm-theme-toggle"[^\n]*position: "absolute", left: "50%", transform: "translateX\(-50%\)", top: "max\(24px/);
});

test("1.0.41: header keeps clear of the status bar", () => {
  assert.ok(index.includes('paddingTop: "max(24px, calc(var(--nm-safe-top, env(safe-area-inset-top, 0px)) + 14px))"'));
  assert.ok(!index.includes('className: "px-4 pt-6 pb-4"'));
});

test("1.0.41: layer title box is gone but its size/padding are unchanged", () => {
  const css = index.match(/\.nm-layer-heading \{[^}]*\}/)[0];
  assert.match(css, /background: transparent; border: 1px solid transparent;/);
  assert.match(css, /min-height: 42px; margin-bottom: 10px; padding: 5px 6px 5px 5px;/);
  assert.ok(!/color-mix\(in srgb, var\(--bg-card\) 92%/.test(css));
});

test("1.0.42: launcher icon theme is switched natively (activity-alias)", () => {
  assert.ok(java.includes("public void setLauncherIcon"));
  assert.ok(helper.includes("setComponentEnabledSetting"));
  const javaKeys = [...helper.match(/THEMES = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  const appKeys = [...index.match(/const NM_ICON_THEMES = \[([\s\S]*?)\n\];/)[1].matchAll(/key: "(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(javaKeys, appKeys);
  assert.ok(index.includes("window.NamelloAndroid.setLauncherIcon(next)"));
});

test("1.0.42: floating return button over other apps (overlay service)", () => {
  const svc = read("native/android/FloatingReturnService.java.tpl");
  assert.ok(svc.includes("TYPE_APPLICATION_OVERLAY") && svc.includes("setAppForeground"));
  assert.ok(!svc.includes("startForeground") && !svc.includes("Notification"), "no foreground service, no notification");
  assert.equal((svc.match(/\{/g) || []).length, (svc.match(/\}/g) || []).length, "balanced braces");
  for (const s of ["enableFloatingReturn", "disableFloatingReturn", "restoreFloatingReturn", "hasOverlayPermission"]) assert.ok(java.includes(s), s);
  assert.ok(java.includes("FloatingReturnService.setAppForeground(true)") && java.includes("FloatingReturnService.setAppForeground(false)"));
  // the existing UI contract in index.html is what the bridge adapts
  assert.ok(index.includes("window.NamelloNative.enableFloatingReturn()"));
  const bridge = read("native-bridge.js");
  assert.ok(bridge.includes("defineProperty(window, 'NamelloNative'") && !/showNotification\s*:/.test(bridge.slice(bridge.indexOf("floatingAdapter"), bridge.indexOf("floatingAdapter") + 400)));
});

test("1.0.43: floating button shows the launcher icon of the chosen theme, without ring or padding", () => {
  const svc = read("native/android/FloatingReturnService.java.tpl");
  assert.ok(!svc.includes("setStroke") && !svc.includes("0xFFD4A64A"), "no gold ring");
  assert.ok(!svc.includes("view.setPadding"), "no padding around the logo");
  assert.ok(svc.includes("IconThemeHelper.currentDrawableName(this)") && svc.includes("refreshIcon"));
  assert.ok(helper.includes('"namello_launcher_" + theme') && helper.includes('"namello_launcher_day_" + todayKey()'));
  assert.ok(java.includes("FloatingReturnService.refreshIcon()"));
  assert.equal((svc.match(/\{/g) || []).length, (svc.match(/\}/g) || []).length, "balanced braces");
});

test("1.0.44: Excel/PDF export works inside the Android app", () => {
  for (const m of ["saveToDownloads", "MediaStore.Downloads", "openUri", "printHtml", "createPrintDocumentAdapter", "PrintManager"]) assert.ok(java.includes(m), m);
  assert.ok(index.includes("window.NamelloAndroid.printHtml(html, String(title || \"Namello\"))"));
  assert.equal((index.match(/NamelloAndroid\.printHtml\(/g) || []).length, 2, "both PDF report builders use the native print dialog");
  assert.ok(!index.includes("Namello 1.0.26"), "PDF header uses the real version");
  assert.equal((index.match(/Namello \$\{NM_VERSION_NAME\}/g) || []).length, 2);
  const bridge = read("native-bridge.js");
  assert.ok(bridge.includes("HTMLAnchorElement.prototype.click") && bridge.includes("saveToDownloads"));
  assert.equal((java.match(/\{/g) || []).length, (java.match(/\}/g) || []).length, "balanced braces");
});

test("1.0.45: statement import decodes UTF-16 MT5 reports", () => {
  assert.ok(index.includes("nmDecodeStatementText(await file.arrayBuffer())"));
  const fn = index.match(/function nmDecodeStatementText\(buf\) \{[\s\S]*?\n\}\nfunction parseStatementHtml/)[0].replace(/function parseStatementHtml$/, "");
  const decode = new Function(fn + "; return nmDecodeStatementText;")();
  const sample = "<table><tr><td>Ticket</td><td>سود</td></tr></table>";
  const utf16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(sample, "utf16le")]);
  assert.equal(decode(utf16.buffer.slice(utf16.byteOffset, utf16.byteOffset + utf16.length)), sample);
  const noBom = Buffer.from(sample, "utf16le");
  assert.equal(decode(noBom.buffer.slice(noBom.byteOffset, noBom.byteOffset + noBom.length)), sample);
  const utf8 = Buffer.from(sample, "utf8");
  assert.equal(decode(utf8.buffer.slice(utf8.byteOffset, utf8.byteOffset + utf8.length)), sample);
});

test("1.0.46: floating button section renamed, text updated, no notification message", () => {
  assert.ok(index.includes('"دکمه شناور بازگشت به Namello"'));
  assert.ok(!index.includes('"نوتیفیکیشن بازگشت به Namello"'), "old title is gone everywhere (title, help dots, help guide)");
  assert.ok(index.includes("هیچ اعلانی در نوار بالای گوشی نشان داده نمی‌شود"));
  assert.ok(index.includes("NM_HELP_GUIDES") && /"دکمه شناور بازگشت به Namello": \{ icon:"🔘"/.test(index));
  assert.ok(java.includes("startService(new Intent(this, FloatingReturnService.class))") && !java.includes("startForegroundService"));
});

test("1.0.46: weekly icon theme (7 images, one per weekday) + fixed themes sub-section", () => {
  const week = [...index.match(/const NM_ICON_WEEK = \[([\s\S]*?)\n\];/)[1].matchAll(/key: "(\w+)", label: "([^"]+)", theme: "([^"]+)", file: "([^"]+)"/g)];
  assert.equal(week.length, 7);
  const helperDays = [...helper.match(/DAYS = \{([^}]*)\}/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]);
  assert.deepEqual(helperDays, ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
  assert.deepEqual(week.map((m) => m[1]).sort(), [...helperDays].sort());
  const names = Object.fromEntries(week.map((m) => [m[1], m[2]]));
  assert.deepEqual(names, { sat: "شنبه", sun: "یکشنبه", mon: "دوشنبه", tue: "سه‌شنبه", wed: "چهارشنبه", thu: "پنجشنبه", fri: "جمعه" });
  for (const m of week) {
    assert.equal(m[4], `icon-day-${m[1]}.jpg`);
    for (const dir of [".", "public"]) assert.ok(fs.existsSync(`${dir}/${m[4]}`), `${dir}/${m[4]}`);
  }
  // each image belongs to the weekday named in the uploaded file (Sunday_Planning ... Saturday_Analysis)
  assert.deepEqual(Object.fromEntries(week.map((m) => [m[1], m[3]])), { sun: "Planning", mon: "Market Awakening", tue: "Momentum", wed: "Balance", thu: "Volatility", fri: "Review", sat: "Analysis" });
  assert.ok(index.includes('"پوسته آیکون متغیر هفتگی"') && index.includes('"پوسته آیکون سفارشی ثابت"'));
  assert.ok(index.includes("persistIconWeekly") && index.includes("window.NamelloAndroid.setWeeklyIcon(on)"));
  assert.ok(index.includes("nmApplyIconTheme(iconTheme, iconWeekly ? dayKey : null)"));
  assert.ok(index.includes("src: iconWeekly ? nmWeekIcon(dayKey)"));
  for (const x of ["setWeeklyIcon", "applyWeeklyIcon"]) assert.ok(java.includes(x), x);
  assert.ok(helper.includes("setAndAllowWhileIdle") && helper.includes("Calendar.DAY_OF_WEEK"));
  assert.equal((helper.match(/\{/g) || []).length, (helper.match(/\}/g) || []).length, "balanced braces");
  assert.ok(read("native-bridge.js").includes("namello_icon_weekly_v1"));
});

test("1.0.46: nmWeekdayKey maps JS weekdays correctly", () => {
  const fn = index.match(/function nmWeekdayKey\(d\) \{[^\n]*\}/)[0];
  const f = new Function(fn + "; return nmWeekdayKey;")();
  assert.equal(f(new Date(2026, 9, 11)), "sun");   // Sunday 11 Oct 2026
  assert.equal(f(new Date(2026, 9, 12)), "mon");
  assert.equal(f(new Date(2026, 9, 16)), "fri");
  assert.equal(f(new Date(2026, 9, 17)), "sat");
});

test("1.0.46: help texts follow the new behaviour", () => {
  assert.ok(index.includes('Weekly Icon Theme') && index.includes('"Navigation bar": {icon:"📱"'));
  assert.ok(index.includes("«پوسته آیکون سفارشی ثابت»") );
  assert.ok(!index.includes("آیکون لانچر در خودِ APK ثابت است"), "outdated APK icon statement removed");
});

test("1.0.47: Excel sheet names never contain forbidden characters or exceed 31 characters", () => {
  const fn = index.match(/function nmSafeSheetName\(name\) \{[\s\S]*?\n\}/)[0];
  const safe = new Function(fn + "; return nmSafeSheetName;")();
  assert.equal(safe("شکرگزاری / Gratitude"), "شکرگزاری - Gratitude");
  assert.equal(safe("R:R"), "R-R");
  assert.equal(safe("a\\b/c?d*e[f]g"), "a-b-c-d-e-f-g");
  assert.equal(safe("").length > 0, true);
  assert.ok(safe("x".repeat(80)).length === 31);
  // every predefined bilingual title (the ones that used to crash with "Sheet name cannot contain ...")
  const map = index.match(/const NM_EXPORT_EXTRA_BI = \{([\s\S]*?)\n\};/)[1];
  const values = [...map.matchAll(/:"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(values.length > 50);
  for (const v of values) {
    const s = safe(v);
    assert.ok(s.length <= 31 && !/[:\\/?*\[\]]/.test(s), v + " -> " + s);
  }
  assert.ok(index.includes("nmSafeSheetName(nmExportBilingualText(name))"));
  assert.ok(index.includes("// نام تکراری") || index.includes("نام تکراری (بعد از کوتاه‌سازی)"));
});

test("1.0.47: PDF print job is started from a main-thread Handler (a detached WebView never runs View.postDelayed)", () => {
  assert.ok(java.includes("new Handler(Looper.getMainLooper()).postDelayed("));
  assert.ok(!/view\.postDelayed\(/.test(java));
  assert.ok(java.includes("toastToPage("), "failures are reported in the page");
});
