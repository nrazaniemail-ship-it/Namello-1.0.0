import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const index = fs.readFileSync("index.html", "utf8");
const java = fs.readFileSync("native/android/MainActivity.java.tpl", "utf8");

function slice(from, to) {
  const a = index.indexOf(from);
  const b = index.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `markers not found: ${from} .. ${to}`);
  return index.slice(a, b);
}

/* ------------------------------------------------------------------ risk calculator */
const riskSrc = slice("const NM_RISK_KEY", "function NmRiskBanner");
const risk = new Function("localStorage", riskSrc + "; return { nmRiskCalc, nmRiskToday, nmRiskStatus, nmRiskLoad, NM_RISK_DEFAULT };")({
  getItem: () => null,
});

test("risk calculator: lots are rounded DOWN so the real risk never exceeds the chosen risk", () => {
  const r = risk.nmRiskCalc({ balance: 10000, riskPct: 1, sl: 20, unitValue: 10, rr: 2 });
  assert.equal(r.riskUsd, 100);
  assert.equal(r.lots, 0.5);               // 100 / (20 * 10)
  assert.equal(r.actualRisk, 100);
  assert.equal(r.rewardUsd, 200);
  assert.equal(r.tp, 40);
  const odd = risk.nmRiskCalc({ balance: 10000, riskPct: 1, sl: 23, unitValue: 10, rr: 1.5 });
  assert.equal(odd.lots, 0.43);            // 0.4347 -> 0.43, not 0.44
  assert.ok(odd.actualRisk <= odd.riskUsd);
  const gold = risk.nmRiskCalc({ balance: 5000, riskPct: 2, sl: 5, unitValue: 100, rr: 2 }); // XAUUSD, $5 stop
  assert.equal(gold.lots, 0.2);
  assert.equal(risk.nmRiskCalc({ balance: 100, riskPct: 1, sl: 50, unitValue: 10 }).lots, 0, "below the minimum lot -> 0");
});

test("risk calculator: invalid input returns null instead of NaN", () => {
  for (const bad of [{ balance: 0 }, { riskPct: 0 }, { sl: 0 }, { unitValue: -1 }, { balance: "" }]) {
    assert.equal(risk.nmRiskCalc({ balance: 1000, riskPct: 1, sl: 10, unitValue: 10, rr: 2, ...bad }), null);
  }
});

test("daily loss guard: levels ok / warn / hit from today's closed trades only", () => {
  const trades = [
    { status: "closed", date: "2026-10-11", pnl: -50, time: "09:00" },
    { status: "closed", date: "2026-10-11", pnl: -60, time: "10:00" },
    { status: "closed", date: "2026-10-10", pnl: -500, time: "10:00" },   // yesterday: ignored
    { status: "open", date: "2026-10-11", pnl: -999 },                    // open: ignored
  ];
  const today = risk.nmRiskToday(trades, "2026-10-11");
  assert.equal(today.pnl, -110);
  assert.equal(today.count, 2);
  assert.equal(today.consec, 2);
  const cfg = (o) => ({ ...risk.NM_RISK_DEFAULT, enabled: true, capMode: "usd", capUsd: 200, ...o });
  assert.equal(risk.nmRiskStatus({ ...cfg(), enabled: false }, 10000, today), null);
  const ok = risk.nmRiskStatus(cfg({ capUsd: 1000 }), 10000, today);
  assert.equal(ok.level, "ok");
  const warn = risk.nmRiskStatus(cfg({ capUsd: 130 }), 10000, today);   // 110/130 = 85% >= 80%
  assert.equal(warn.level, "warn");
  assert.equal(Math.round(warn.remaining), 20);
  const hit = risk.nmRiskStatus(cfg({ capUsd: 100 }), 10000, today);
  assert.equal(hit.level, "hit");
  assert.ok(hit.reasons[0].includes("سقف ضرر روزانه"));
  const pct = risk.nmRiskStatus(cfg({ capMode: "pct", capPct: 1 }), 10000, today);  // 1% of 10000 = 100
  assert.equal(pct.capUsd, 100);
  assert.equal(pct.level, "hit");
  const trades2 = risk.nmRiskStatus(cfg({ capUsd: 5000, maxTrades: 2 }), 10000, today);
  assert.equal(trades2.level, "hit");
  const consec = risk.nmRiskStatus(cfg({ capUsd: 5000, maxConsecLosses: 2 }), 10000, today);
  assert.equal(consec.level, "hit");
  const nearTrades = risk.nmRiskStatus(cfg({ capUsd: 5000, maxTrades: 3 }), 10000, today);
  assert.equal(nearTrades.level, "warn", "one trade before the max -> warning");
});

test("a profitable day never triggers the loss cap, and a win ends the consecutive-loss streak", () => {
  const today = risk.nmRiskToday([
    { status: "closed", date: "d", pnl: -50, time: "1" }, { status: "closed", date: "d", pnl: 80, time: "2" },
  ], "d");
  assert.equal(today.consec, 0);
  const st = risk.nmRiskStatus({ ...risk.NM_RISK_DEFAULT, enabled: true, capMode: "usd", capUsd: 100 }, 1000, today);
  assert.equal(st.loss, 0);
  assert.equal(st.level, "ok");
});

/* ------------------------------------------------------------------ app lock */
test("app lock: PIN is hashed (PBKDF2), verified, and locked out after 5 failures", async () => {
  const lockSrc = slice("const NM_LOCK_LS", "function nmLockCanBio");
  const store = new Map();
  const localStorageMock = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const api = new Function("localStorage", "crypto", "window", lockSrc + "; return { nmLockSetPin, nmLockCheckPin, nmLockLoad, nmLockActive };")(localStorageMock, globalThis.crypto, { crypto: globalThis.crypto });
  await api.nmLockSetPin("2468");
  const c = api.nmLockLoad();
  assert.ok(api.nmLockActive(c));
  assert.equal(c.len, 4);
  assert.match(c.hash, /^[0-9a-f]{64}$/);
  assert.ok(!JSON.stringify([...store.values()]).includes("2468"), "the PIN itself is never stored");
  assert.deepEqual(await api.nmLockCheckPin("2468"), { ok: true });
  for (let i = 0; i < 4; i++) {
    const r = await api.nmLockCheckPin("0000");
    assert.equal(r.ok, false);
    assert.equal(r.left, 4 - i);
  }
  const fifth = await api.nmLockCheckPin("0000");
  assert.equal(fifth.ok, false);
  assert.ok(fifth.wait >= 29, "temporary lock-out after 5 failures");
  const blocked = await api.nmLockCheckPin("2468");           // even the right PIN waits during the lock-out
  assert.equal(blocked.ok, false);
  assert.ok(blocked.wait > 0);
  // a new salt for every PIN
  await api.nmLockSetPin("2468");
  assert.notEqual(api.nmLockLoad().hash, c.hash);
});

/* ------------------------------------------------------------------ wiring / contracts */
test("app lock, risk guard and native backup are wired into the app", () => {
  for (const s of ["const { locked, unlock } = useAppLock();", "locked && RE(NmLockScreen, { onUnlock: unlock })", "RE(NmAppLockCard, { showToast })",
    "RE(NmRiskGuardCard, { cfg: riskCfg, onChange: persistRiskCfg, status: riskStatus, balance: riskBalance })",
    "riskStatus && riskStatus.level !== \"ok\" && RE(NmRiskBanner", "useNativeBackupGuard(loaded);", "nmBkNativeSave(name, text, \"Namello-auto-\", 8)"]) {
    assert.ok(index.includes(s), s);
  }
  assert.ok(index.includes('title: "قفل برنامه"') && index.includes('title: "ماشین‌حساب ریسک و سقف ضرر روزانه"'));
  assert.ok(index.includes('"قفل برنامه": {icon:"🔒"') && index.includes('"ماشین‌حساب ریسک و سقف ضرر روزانه": {icon:"🛡️"'));
  assert.ok(!/localStorage\.setItem\("ns_" \+ NM_LOCK_LS/.test(index), "lock data stays out of window.storage / backups");
});

test("native: biometric prompt, secure screen, backup folder + pruning", () => {
  for (const m of ["public boolean canAuthenticate", "public void authenticate", "BiometricPrompt.Builder", "FLAG_SECURE", "public void setSecureScreen",
    "saveToDownloadsIn", "public int pruneDownloads", "__nmAuthResult"]) assert.ok(java.includes(m), m);
  assert.equal((java.match(/\{/g) || []).length, (java.match(/\}/g) || []).length, "balanced braces");
  assert.equal((java.match(/\(/g) || []).length, (java.match(/\)/g) || []).length, "balanced parentheses");
  const imports = [...java.matchAll(/^import (.+);/gm)].map((m) => m[1]);
  assert.equal(new Set(imports).size, imports.length, "no duplicate imports");
});

test("weekly icons: 7 images, 512x512 JPEG, identical in root and public", () => {
  for (const d of ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]) {
    const a = fs.readFileSync(`icon-day-${d}.jpg`);
    const b = fs.readFileSync(`public/icon-day-${d}.jpg`);
    assert.deepEqual(a, b);
    assert.equal(a[0], 0xff); assert.equal(a[1], 0xd8);            // JPEG magic
    // read the JPEG size from the SOF marker
    let i = 2, w = 0, h = 0;
    while (i < a.length) { if (a[i] !== 0xff) { i++; continue; } const m = a[i + 1]; if (m >= 0xc0 && m <= 0xc3) { h = a.readUInt16BE(i + 5); w = a.readUInt16BE(i + 7); break; } i += 2 + a.readUInt16BE(i + 2); }
    assert.deepEqual([w, h], [512, 512], d);
  }
});

test("backup helper: text -> base64 (UTF-8 safe, large files)", () => {
  const fn = index.match(/function nmB64FromText\(text\) \{[\s\S]*?\n\}/)[0];
  const b64 = new Function(fn + "; return nmB64FromText;")();
  const sample = JSON.stringify({ note: "پشتیبان فارسی ✓", n: [1, 2, 3] });
  assert.equal(Buffer.from(b64(sample), "base64").toString("utf8"), sample);
  const big = "داده".repeat(200000);                       // ~1.6 MB, crosses the 32 KB chunk size many times
  assert.equal(Buffer.from(b64(big), "base64").toString("utf8"), big);
});
