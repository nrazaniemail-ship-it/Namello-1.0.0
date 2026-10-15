import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const SOURCE = fs.readFileSync(new URL("../native-bridge.js", import.meta.url), "utf8");
const RealDate = Date;

/** Builds a fake WebView / Capacitor environment, runs native-bridge.js in it and returns handles. */
function boot({ saveResult = "ok|file|content://downloads/1", native = true, now = RealDate.UTC(2026, 9, 10, 12, 0, 0), permission = "granted", exact = "granted", withServiceWorker = false, storageData = {}, localData = {} } = {}) {
  let NOW = now;
  class FakeDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(NOW); else super(...a); }
    static now() { return NOW; }
  }
  const timers = [];
  const calls = [];
  const listeners = {};
  const pending = [];
  const local = new Map(Object.entries(localData));
  const toasts = [];
  const chromeColors = [];
  const androidCalls = [];
  let blobCounter = 0;
  class FakeAnchor {
    constructor() { this.href = ""; this.download = ""; this.clicked = 0; }
    hasAttribute(n) { return n === "download" ? !!this.download : false; }
    click() { this.clicked++; }
  }
  const FakeURL = { createObjectURL: () => "blob:fake/" + (++blobCounter) };

  const LocalNotifications = {
    checkPermissions: async () => ({ display: permission }),
    requestPermissions: async () => ({ display: permission }),
    createChannel: async (o) => { calls.push(["createChannel", o]); },
    schedule: async (o) => { calls.push(["schedule", o]); o.notifications.forEach((n) => { if (n.schedule) pending.push({ id: n.id }); }); },
    getPending: async () => ({ notifications: pending.slice() }),
    cancel: async (o) => { calls.push(["cancel", o]); o.notifications.forEach((n) => { const i = pending.findIndex((p) => p.id === n.id); if (i >= 0) pending.splice(i, 1); }); },
    checkExactNotificationSetting: async () => ({ exact_alarm: exact }),
    changeExactNotificationSetting: async () => { calls.push(["changeExact"]); },
  };
  const Filesystem = { writeFile: async (o) => { calls.push(["writeFile", o]); return { uri: "file:///cache/" + o.path }; } };
  const Share = { share: async (o) => { calls.push(["share", o]); } };

  const window = {
    Capacitor: native ? { isNativePlatform: () => true, Plugins: { LocalNotifications, Filesystem, Share } } : undefined,
    storage: { get: async (k) => (k in storageData ? { key: k, value: JSON.stringify(storageData[k]) } : null) },
    NamelloAndroid: {
      setChromeColor: (h) => chromeColors.push(h),
      saveToDownloads: (name, mime, b64) => { androidCalls.push(["save", name, mime, b64]); return saveResult; },
      openUri: (uri, mime) => { androidCalls.push(["open", uri, mime]); return true; },
    },
    addEventListener: (n, f) => { (listeners[n] = listeners[n] || []).push(f); },
    dispatchEvent: (e) => { toasts.push(e.detail); return true; },
  };
  const documentStub = {
    documentElement: { classList: { add() { } } },
    body: { appendChild() { }, style: {} },
    visibilityState: "visible",
    addEventListener: (n, f) => { (listeners["doc:" + n] = listeners["doc:" + n] || []).push(f); },
    createElement: () => ({ style: {}, remove() { } }),
  };
  const navigator = withServiceWorker ? { serviceWorker: { ready: Promise.reject(new Error("never")).catch(() => { }) } } : {};
  const context = vm.createContext({
    window, document: documentStub, navigator, Intl, Date: FakeDate, Promise, JSON, Math, console,
    localStorage: { getItem: (k) => (local.has(k) ? local.get(k) : null), setItem: (k, v) => local.set(k, String(v)) },
    location: { origin: "https://localhost" },
    CustomEvent: class { constructor(n, o) { this.type = n; this.detail = o && o.detail; } },
    MutationObserver: class { observe() { } },
    getComputedStyle: () => ({ getPropertyValue: () => "#12161C", color: "rgb(18, 22, 28)", backgroundColor: "rgb(11, 14, 17)" }),
    FileReader: class { readAsDataURL() { this.result = "data:application/octet-stream;base64,QUJD"; setTimeout(() => this.onload(), 0); } },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: () => { },
    setInterval: () => 0,
    HTMLAnchorElement: FakeAnchor, URL: FakeURL, Blob,
    fetch: async () => ({ blob: async () => new Blob(["data"]) }),
  });
  window.window = window;
  context.window = window;
  // names like Notification / navigator.serviceWorker are installed on `window` / `navigator` by the bridge
  vm.runInContext(SOURCE, context);
  const ctx = {
    window, navigator, calls, pending, toasts, chromeColors, listeners, androidCalls, FakeAnchor, FakeURL, Blob,
    makeBlobUrl: (blob) => context.URL.createObjectURL(blob),
    setNow: (v) => { NOW = v; },
    flushTimers: async () => {
      for (let i = 0; i < 5; i++) {
        const batch = timers.splice(0, timers.length);
        for (const t of batch) { if (t.ms >= 1000 || t.ms === 250) await t.fn(); }
        await new Promise((r) => setImmediate(r));
      }
    },
    scheduled: () => calls.filter((c) => c[0] === "schedule").flatMap((c) => c[1].notifications).filter((n) => n.schedule),
    immediate: () => calls.filter((c) => c[0] === "schedule").flatMap((c) => c[1].notifications).filter((n) => !n.schedule),
  };
  return ctx;
}
const settle = () => new Promise((r) => setImmediate(r));

test("does nothing in a normal browser", () => {
  const env = boot({ native: false });
  assert.equal(env.window.Notification, undefined);
  assert.equal(env.window.NamelloNativeFiles, undefined);
});

test("Notification polyfill reports and requests permission", async () => {
  const env = boot({ permission: "granted" });
  assert.equal(env.window.Notification.permission, "default"); // before the async check finishes
  await settle(); await settle();
  assert.equal(env.window.Notification.permission, "granted");
  assert.equal(await env.window.Notification.requestPermission(), "granted");
  assert.ok(env.calls.some((c) => c[0] === "createChannel"));
});

test("denied permission never shows a notification and explains how to enable it", async () => {
  const env = boot({ permission: "denied" });
  await settle(); await settle();
  assert.equal(await env.window.Notification.requestPermission(), "denied");
  new env.window.Notification("x", { body: "y" });
  await settle();
  assert.equal(env.immediate().length, 0);
  assert.ok(env.toasts.some((t) => /اعلان/.test(String(t))));
});

test("registration.showNotification works through navigator.serviceWorker.ready (with and without a real SW)", async () => {
  for (const withServiceWorker of [false, true]) {
    const env = boot({ withServiceWorker });
    await settle(); await settle();
    const reg = await env.navigator.serviceWorker.ready;
    await reg.showNotification("پیام", { body: "متن", silent: false });
    const shown = env.immediate();
    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, "پیام");
    assert.equal(shown[0].channelId, "namello-alerts");
    const quiet = boot({ withServiceWorker });
    await settle(); await settle();
    await (await quiet.navigator.serviceWorker.ready).showNotification("q", { body: "b", silent: true });
    assert.equal(quiet.immediate()[0].channelId, "namello-quiet");
    assert.equal((await reg.getNotifications({ tag: "t" })).length, 0);
  }
});

test("identical notifications within 5 seconds are shown once", async () => {
  const env = boot();
  await settle(); await settle();
  new env.window.Notification("a", { body: "b" });
  new env.window.Notification("a", { body: "b" });
  await settle();
  assert.equal(env.immediate().length, 1);
});

test("session start/end alarms are pre-scheduled at the correct New York (DST aware) time", async () => {
  const config = {
    sessions: [{ key: "sydney", name: "نشست سیدنی", dst: { s: [18, 0], e: [3, 0] }, std: { s: [17, 0], e: [2, 0] }, alarmStart: true, alarmEnd: true }],
    killzones: [{ key: "nykz", name: "کیل‌زون نیویورک", dst: { s: [9, 30], e: [12, 0] }, std: { s: [8, 30], e: [11, 0] }, alarmStart: true, alarmEnd: false }],
    silverbullets: [],
  };
  const env = boot({ now: RealDate.UTC(2026, 9, 10, 12, 0, 0), storageData: { namello_session_config_v3: config } });
  await settle(); await settle();
  await env.flushTimers();
  const byTitle = Object.fromEntries(env.scheduled().map((n) => [n.title + "@" + new RealDate(n.schedule.at).toISOString(), n]));
  // 10 Oct 2026 is EDT (UTC-4): Sydney 18:00 NY = 22:00Z, ends 03:00 NY next day = 07:00Z
  assert.ok(byTitle["شروع نشست سیدنی@2026-10-10T22:00:00.000Z"], "sydney start");
  assert.ok(byTitle["پایان نشست سیدنی@2026-10-11T07:00:00.000Z"], "sydney end");
  assert.ok(byTitle["شروع کیل‌زون نیویورک@2026-10-11T13:30:00.000Z"], "ny kz start next day (09:30 EDT)");
  assert.ok(env.scheduled().every((n) => n.schedule.allowWhileIdle === true));
  assert.ok(env.scheduled().every((n) => n.id >= 100000 && n.id < 1000000));
});

test("after the DST change (EST, UTC-5) the standard-time window is used", async () => {
  const config = { sessions: [{ key: "sydney", name: "S", dst: { s: [18, 0], e: [3, 0] }, std: { s: [17, 0], e: [2, 0] }, alarmStart: true }], killzones: [], silverbullets: [] };
  const env = boot({ now: RealDate.UTC(2026, 10, 3, 12, 0, 0), storageData: { namello_session_config_v3: config } }); // 3 Nov 2026
  await settle(); await settle(); await env.flushTimers();
  const first = env.scheduled()[0];
  assert.equal(new RealDate(first.schedule.at).toISOString(), "2026-11-03T22:00:00.000Z"); // 17:00 EST
});

test("news alarms schedule a 30-second warning and the event itself", async () => {
  const at = RealDate.UTC(2026, 9, 10, 14, 0, 0);
  const env = boot({ storageData: { namello_news_events_v1: [{ id: "n1", title: "NFP", currency: "USD", datetime: new RealDate(at).toISOString(), alarmStart: true }, { id: "n2", title: "off", currency: "EUR", datetime: new RealDate(at).toISOString(), alarmStart: false, alarmUser: true }] } });
  await settle(); await settle(); await env.flushTimers();
  const list = env.scheduled();
  assert.equal(list.length, 2);
  assert.equal(new RealDate(list[0].schedule.at).getTime(), at - 30 * 1000);
  assert.equal(new RealDate(list[1].schedule.at).getTime(), at);
  assert.ok(list[0].title.includes("NFP"));
});

test("motivational messages are scheduled from nextAt and the in-app duplicate is suppressed", async () => {
  const now = RealDate.UTC(2026, 9, 10, 12, 0, 0);
  const env = boot({
    now,
    localData: {
      namello_motivational_settings_v1: JSON.stringify({ enabled: true, intervalMs: 1800000, nextAt: now + 10 * 60 * 1000 }),
      namello_motivational_messages_v1: JSON.stringify([{ id: "a", text: "یک" }, { id: "b", text: "دو" }]),
    },
  });
  await settle(); await settle(); await env.flushTimers();
  const list = env.scheduled();
  assert.equal(list.length, 48);
  assert.equal(new RealDate(list[0].schedule.at).getTime(), now + 10 * 60 * 1000);
  assert.equal(new RealDate(list[1].schedule.at).getTime(), now + 40 * 60 * 1000);
  // the web-timer firing at the same moment must not create a second notification
  env.setNow(now + 10 * 60 * 1000 + 800);
  new env.window.Notification("پیام انگیزشی Namello", { body: "هر متنی" });
  await settle();
  assert.equal(env.immediate().length, 0);
});

test("previous pre-scheduled alarms are cancelled, foreign ids are left alone", async () => {
  const config = { sessions: [{ key: "s", name: "S", dst: { s: [18, 0], e: [3, 0] }, std: { s: [17, 0], e: [2, 0] }, alarmStart: true }], killzones: [], silverbullets: [] };
  const env = boot({ storageData: { namello_session_config_v3: config } });
  env.pending.push({ id: 100005 }, { id: 5 }, { id: 1500000000 });
  await settle(); await settle(); await env.flushTimers();
  const cancel = env.calls.find((c) => c[0] === "cancel");
  assert.ok(cancel, "cancel was called");
  assert.equal(JSON.stringify(cancel[1].notifications.map((n) => n.id)), "[100005]");
  assert.ok(env.pending.some((p) => p.id === 5) && env.pending.some((p) => p.id === 1500000000));
});

test("exact-alarm settings are opened once when the user enables notifications", async () => {
  const env = boot({ exact: "denied" });
  await settle(); await settle();
  const first = env.window.Notification.requestPermission();
  for (let i = 0; i < 6; i++) { await settle(); await env.flushTimers(); }
  await first;
  assert.equal(env.calls.filter((c) => c[0] === "changeExact").length, 1);
  const second = env.window.Notification.requestPermission();
  for (let i = 0; i < 6; i++) { await settle(); await env.flushTimers(); }
  await second;
  assert.equal(env.calls.filter((c) => c[0] === "changeExact").length, 1, "asked only once");
});

test("shareBlob writes the file to the cache and opens the Android share sheet", async () => {
  const env = boot();
  await settle(); await settle();
  const ok = await env.window.NamelloNativeFiles.shareBlob({}, "کتاب: تست?.txt", "text/plain", "کتاب");
  assert.equal(ok, true);
  const w = env.calls.find((c) => c[0] === "writeFile")[1];
  assert.equal(w.directory, "CACHE");
  assert.ok(!/[:?]/.test(w.path.split("/").pop()));
  assert.equal(w.data, "QUJD");
  assert.ok(env.calls.find((c) => c[0] === "share")[1].url.startsWith("file:///cache/"));
});

test("system bar colour follows the app theme", async () => {
  const env = boot();
  await settle();
  for (const f of env.listeners["load"] || []) f();
  await env.flushTimers();
  assert.ok(env.chromeColors.includes("#121619") || env.chromeColors.includes("#12161c"));
});

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms));
function clickDownload(env, name, href) {
  const a = new env.FakeAnchor();
  a.download = name;
  a.href = href || env.makeBlobUrl(new env.Blob(["x"]));
  a.click();
  return a;
}

test("Excel download (<a download> / XLSX.writeFile) is saved to Download and opened", async () => {
  const env = boot();
  await settle(); await settle();
  const a = clickDownload(env, "namello-journal.xlsx");
  await wait();
  assert.equal(a.clicked, 0, "the broken WebView download must not run");
  const save = env.androidCalls.find((c) => c[0] === "save");
  assert.ok(save, "saveToDownloads called");
  assert.equal(save[1], "namello-journal.xlsx");
  assert.equal(save[2], "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  assert.equal(save[3], "QUJD");
  assert.ok(env.androidCalls.some((c) => c[0] === "open" && c[1] === "content://downloads/1"), "Excel is opened");
  assert.ok(env.toasts.some((t) => /Download/.test(String(t))));
});

test("CSV / JSON are saved but not opened automatically", async () => {
  const env = boot();
  await settle(); await settle();
  clickDownload(env, "trades.csv");
  await wait();
  clickDownload(env, "backup.json");
  await wait();
  assert.deepEqual(env.androidCalls.filter((c) => c[0] === "save").map((c) => c[2]), ["text/csv", "application/json"]);
  assert.equal(env.androidCalls.filter((c) => c[0] === "open").length, 0);
});

test("on Android 9 or older (unsupported) the share sheet is used instead", async () => {
  const env = boot({ saveResult: "unsupported" });
  await settle(); await settle();
  clickDownload(env, "report.xlsx");
  await wait();
  assert.ok(env.calls.some((c) => c[0] === "writeFile"), "file written to cache");
  assert.ok(env.calls.some((c) => c[0] === "share"), "share sheet opened");
});

test("normal anchors (no download attribute / http links) are left alone", async () => {
  const env = boot();
  await settle(); await settle();
  const a = new env.FakeAnchor();
  a.href = "https://example.com/";
  a.click();
  assert.equal(a.clicked, 1);
  const b = clickDownload(env, "x.pdf", "https://example.com/x.pdf");
  assert.equal(b.clicked, 1, "a normal https download link is untouched");
  assert.equal(env.androidCalls.length, 0);
});

test("statement file inputs are opened without an accept filter in the app", async () => {
  const env = boot();
  await settle(); await settle();
  const handlers = env.listeners["doc:click"] || [];
  assert.ok(handlers.length >= 1);
  const input = { tagName: "INPUT", type: "file", attrs: { accept: ".csv,.xlsx,.xls,.htm,.html" }, getAttribute(n) { return this.attrs[n] || ""; }, setAttribute(n, v) { this.attrs[n] = v; } };
  const other = { tagName: "INPUT", type: "file", attrs: { accept: ".pdf,.epub,.txt" }, getAttribute(n) { return this.attrs[n] || ""; }, setAttribute(n, v) { this.attrs[n] = v; } };
  for (const h of handlers) { h({ target: input }); h({ target: other }); }
  assert.equal(input.attrs.accept, "");
  assert.equal(other.attrs.accept, ".pdf,.epub,.txt", "library inputs keep their filter");
});
