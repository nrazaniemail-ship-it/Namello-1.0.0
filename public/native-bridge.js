/*
 * Namello native bridge
 * ---------------------------------------------------------------------------
 * Loaded by index.html before the main application script. It does NOTHING in a normal browser /
 * PWA. Inside the installed Android app (Capacitor) it fills the gaps of the Android WebView:
 *
 *   1. Notifications  - the WebView has no Web Notification API, so `Notification`,
 *                       `Notification.requestPermission()` and `registration.showNotification()`
 *                       are provided on top of @capacitor/local-notifications. The existing app
 *                       code (session alarms, news alarms, motivational messages, "return to
 *                       Namello") therefore works unchanged.
 *   2. Background     - JS timers are frozen when the app is in the background, so upcoming session
 *      alarms           start/end alarms, news alarms and motivational messages are pre-scheduled as
 *                       native alarms (next ~36 h) and refreshed whenever the app is opened/closed.
 *   3. Files          - window.NamelloNativeFiles.shareBlob() opens the Android "open with / share"
 *                       sheet (WebView has no navigator.share for files).
 *   4. System bars    - tells MainActivity which colour the navigation/status bar should use so it
 *                       follows the light/dark theme.
 *
 * Plugin calls go through window.Capacitor.Plugins (or Capacitor.nativePromise as a fallback), so no
 * bundler is required.
 */
(function () {
  'use strict';

  var cap = window.Capacitor;
  var isNative = false;
  try {
    isNative = !!(cap && ((typeof cap.isNativePlatform === 'function' && cap.isNativePlatform()) ||
      (typeof cap.getPlatform === 'function' && cap.getPlatform() === 'android')));
  } catch (e) { isNative = false; }
  if (!isNative) return;

  try { document.documentElement.classList.add('nm-native'); } catch (e) { }

  /* ------------------------------------------------------------------ constants */
  var CH_ALERT = 'namello-alerts';
  var CH_QUIET = 'namello-quiet';
  var SMALL_ICON = 'ic_stat_namello';
  // Large notification artwork; configure-android copies these assets into drawable-nodpi.
  function categoryIcon(title, body, extra) {
    var meta = extra || {};
    var data = meta.data || {};
    // Explicit category metadata must win over words in a title/body. For example, an
    // evaluation recommendation may mention a news event, but it should keep the evaluation logo.
    var structured = [meta.kind, meta.category, data.kind, data.category, data.type];
    for (var i = 0; i < structured.length; i++) {
      var token = String(structured[i] == null ? '' : structured[i]).toLowerCase().replace(/[ _-]+/g, '');
      if (/^(motivation|motivational|انگیزشی|library|کتابخانه)$/.test(token)) return 'nm_notif_motivation';
      if (/^(news|economicnews|خبر|اخبار|خبرها)$/.test(token)) return 'nm_notif_news';
      if (/^(session|sessions|event|events|نشست|نشستها|رویداد)$/.test(token)) return 'nm_notif_sessions';
      if (/^(psychology|tradingpsychology|psych|روانشناسی|روانشناسی معاملهگری)$/.test(token)) return 'nm_notif_psychology';
      if (/^(evaluation|advancedevaluation|marketbehavior|ارزیابی|ارزیابیرفتاربازار)$/.test(token)) return 'nm_notif_evaluation';
    }
    // Legacy callers without structured metadata are classified from visible text.
    var hay = [title || '', body || '', meta.tag || ''].join(' ').toLowerCase();
    if (/motivat|انگیز|کتابخانه|library/.test(hay)) return 'nm_notif_motivation';
    if (/news|خبر|اقتصاد|تقویم اقتصادی/.test(hay)) return 'nm_notif_news';
    if (/session|نشست|kill.?zone|silver.?bullet/.test(hay)) return 'nm_notif_sessions';
    if (/psych|روانشناسی|روان‌شناسی|trading.?psych/.test(hay)) return 'nm_notif_psychology';
    if (/evaluation|ارزیابی|market.?behavior|advanced.?evaluation|chart|چارت/.test(hay)) return 'nm_notif_evaluation';
    return null;
  }
  var PLAN_ID_BASE = 100000;          // ids [100000, 999999] are owned by the scheduler
  var PLAN_ID_LIMIT = 1000000;
  var HORIZON_MS = 36 * 3600 * 1000;  // how far ahead alarms are pre-scheduled
  var MAX_MOTIVATION = 48;
  var MAX_PLAN = 180;                 // stay far below Android's per-app alarm limit
  var DEDUPE_WINDOW_MS = 150 * 1000;
  var KEY_CONFIG = 'namello_session_config_v3';
  var KEY_NEWS = 'namello_news_events_v1';
  var KEY_MOTIV_MSGS = 'namello_motivational_messages_v1';
  var KEY_MOTIV_SET = 'namello_motivational_settings_v1';
  var KEY_TEXT_NOTIFS = 'namello_text_notification_settings_v1';
  var KEY_EXACT_ASKED = 'namello_native_exact_alarm_asked_v1';
  var MOTIV_TITLE = 'پیام انگیزشی Namello';

  var permission = 'default';
  var plan = [];            // notifications currently scheduled natively: {id, at, title, body}
  var lastSignature = '';
  var syncing = false;
  var syncAgain = false;
  var recent = [];
  var immediateCounter = 0;

  /* ------------------------------------------------------------------ plugin access */
  function plugin(name) {
    try { return cap.Plugins && cap.Plugins[name]; } catch (e) { return null; }
  }
  function call(name, method, options) {
    try {
      var p = plugin(name);
      if (p && typeof p[method] === 'function') return Promise.resolve(p[method](options || {}));
      if (typeof cap.nativePromise === 'function') return Promise.resolve(cap.nativePromise(name, method, options || {}));
    } catch (e) { return Promise.reject(e); }
    return Promise.reject(new Error('plugin-unavailable:' + name + '.' + method));
  }
  function toast(msg) {
    try { window.dispatchEvent(new CustomEvent('namello-toast', { detail: msg })); } catch (e) { }
  }

  /* ------------------------------------------------------------------ permission */
  function mapPermission(res) {
    var d = res && (res.display || res.receive);
    return d === 'granted' ? 'granted' : (d === 'denied' ? 'denied' : 'default');
  }
  var channelsPromise = null;
  function ensureChannels() {
    if (channelsPromise) return channelsPromise;
    var ch1 = call('LocalNotifications', 'createChannel', {
      id: CH_ALERT, name: 'هشدارهای Namello', description: 'آلارم نشست‌ها، اخبار و پیام‌های انگیزشی',
      importance: 5, visibility: 1, vibration: true, lights: true
    }).catch(function () { });
    var ch2 = call('LocalNotifications', 'createChannel', {
      id: CH_QUIET, name: 'اعلان‌های بی‌صدا', description: 'یادآوری بازگشت به Namello',
      importance: 2, visibility: 1, vibration: false
    }).catch(function () { });
    channelsPromise = Promise.all([ch1, ch2]);
    return channelsPromise;
  }
  function refreshPermission() {
    return call('LocalNotifications', 'checkPermissions').then(function (r) {
      permission = mapPermission(r);
      if (permission === 'granted') ensureChannels();
      return permission;
    }).catch(function () { return permission; });
  }
  function maybeAskExactAlarm() {
    // Android 12+/14+: exact alarms need a user-granted special permission. Ask once, politely.
    try { if (localStorage.getItem(KEY_EXACT_ASKED)) return Promise.resolve(); } catch (e) { }
    return call('LocalNotifications', 'checkExactNotificationSetting').then(function (r) {
      if (r && r.exact_alarm === 'denied') {
        try { localStorage.setItem(KEY_EXACT_ASKED, '1'); } catch (e) { }
        toast('برای دقیق بودن آلارم‌ها، در صفحه‌ی بعد دسترسی «آلارم‌ها و یادآورها» را روشن کن.');
        return new Promise(function (resolve) { setTimeout(resolve, 1500); }).then(function () {
          return call('LocalNotifications', 'changeExactNotificationSetting');
        });
      }
    }).catch(function () { });
  }
  function requestPermission() {
    return call('LocalNotifications', 'requestPermissions').then(function (r) {
      permission = mapPermission(r);
      if (permission === 'granted') {
        return ensureChannels().then(function () { scheduleSync(true); return maybeAskExactAlarm(); }).then(function () { return permission; });
      }
      if (permission === 'denied') toast('اجازه‌ی اعلان داده نشد. از تنظیمات گوشی ← برنامه‌ها ← Namello ← اعلان‌ها آن را روشن کن.');
      return permission;
    }).catch(function () { return permission; });
  }

  /* ------------------------------------------------------------------ showing notifications */
  function immediateId() {
    immediateCounter = (immediateCounter + 1) % 1000;
    return 1000000000 + ((Date.now() % 900000) * 1000) + immediateCounter; // < 2^31
  }
  function isCoveredByPlan(title, now) {
    for (var i = 0; i < plan.length; i++) {
      var p = plan[i];
      if (p.title === title && Math.abs(p.at - now) <= DEDUPE_WINDOW_MS) return true;
    }
    return false;
  }
  function isDuplicate(title, body, now) {
    recent = recent.filter(function (r) { return now - r.t < 5000; });
    var k = title + '\u0001' + body;
    for (var i = 0; i < recent.length; i++) if (recent[i].k === k) return true;
    recent.push({ k: k, t: now });
    return false;
  }
  function show(title, options) {
    options = options || {};
    title = String(title == null ? '' : title);
    var body = options.body == null ? '' : String(options.body);
    var now = Date.now();
    if (permission !== 'granted') return Promise.resolve();
    // "return to Namello" is posted natively by MainActivity.onStop (reliable when the app is backgrounded)
    if (options.tag === 'namello-return' && window.NamelloAndroid && typeof window.NamelloAndroid.enableFloatingReturn === 'function') return Promise.resolve();
    if (isDuplicate(title, body, now)) return Promise.resolve();
    if (isCoveredByPlan(title, now)) return Promise.resolve(); // the pre-scheduled native alarm shows it
    var n = {
      id: immediateId(), title: title, body: body,
      channelId: options.silent ? CH_QUIET : CH_ALERT,
      smallIcon: SMALL_ICON, extra: { tag: options.tag || '' }
    };
    if (body.length > 40) n.largeBody = body;
    return call('LocalNotifications', 'schedule', { notifications: [n] }).catch(function (e) {
      try { console.warn('[Namello native] notification failed', e); } catch (e2) { }
    });
  }

  /* Notification polyfill (WebView has none) */
  function NativeNotification(title, options) {
    options = options || {};
    this.title = String(title);
    this.body = options.body || '';
    this.tag = options.tag || '';
    this.data = options.data;
    this.onclick = null;
    this.close = function () { };
    this.addEventListener = function () { };
    this.removeEventListener = function () { };
    show(title, options);
  }
  NativeNotification.requestPermission = function (callback) {
    return requestPermission().then(function (p) { if (typeof callback === 'function') { try { callback(p); } catch (e) { } } return p; });
  };
  NativeNotification.maxActions = 0;
  try {
    Object.defineProperty(NativeNotification, 'permission', { get: function () { return permission; }, enumerable: true });
  } catch (e) { }
  try {
    Object.defineProperty(window, 'Notification', { value: NativeNotification, configurable: true, writable: true });
  } catch (e) { try { window.Notification = NativeNotification; } catch (e2) { } }

  /* ServiceWorkerRegistration stand-in so `await navigator.serviceWorker.ready` always resolves */
  var fakeRegistration = {
    scope: (location && location.origin ? location.origin : '') + '/',
    active: { state: 'activated' },
    showNotification: function (title, options) { return show(title, options); },
    getNotifications: function () { return Promise.resolve([]); },
    update: function () { return Promise.resolve(); },
    unregister: function () { return Promise.resolve(false); },
    addEventListener: function () { },
    removeEventListener: function () { }
  };
  try {
    if (navigator.serviceWorker) {
      Object.defineProperty(navigator.serviceWorker, 'ready', { configurable: true, get: function () { return Promise.resolve(fakeRegistration); } });
    } else {
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(fakeRegistration),
          register: function () { return Promise.resolve(fakeRegistration); },
          getRegistration: function () { return Promise.resolve(undefined); },
          getRegistrations: function () { return Promise.resolve([]); },
          addEventListener: function () { },
          removeEventListener: function () { }
        }
      });
    }
  } catch (e) { }

  /* ------------------------------------------------------------------ New-York time helpers */
  var nyFormatter = null;
  function nyParts(ms) {
    if (!nyFormatter) {
      nyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York', hour12: false,
        year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
      });
    }
    var parts = {};
    nyFormatter.formatToParts(new Date(ms)).forEach(function (p) { parts[p.type] = p.value; });
    var hh = parseInt(parts.hour, 10); if (hh === 24) hh = 0;
    return {
      y: parseInt(parts.year, 10), m: parseInt(parts.month, 10), d: parseInt(parts.day, 10),
      hh: hh, mi: parseInt(parts.minute, 10), dst: parts.timeZoneName === 'EDT'
    };
  }
  /** Wall-clock time in New York -> UTC milliseconds (handles DST like the app's nyWallTimeToUTC). */
  function nyWallToUtc(y, m, d, hh, mi) {
    var wanted = Date.UTC(y, m - 1, d, hh, mi, 0);
    var g = nyParts(wanted);
    var nyGuess = Date.UTC(g.y, g.m - 1, g.d, g.hh, g.mi, 0);
    return wanted + (wanted - nyGuess);
  }
  function addDays(y, m, d, n) {
    var t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
  }

  /* ------------------------------------------------------------------ plan builders */
  function readStorageJson(key) {
    try {
      if (!window.storage || typeof window.storage.get !== 'function') return Promise.resolve(null);
      return Promise.resolve(window.storage.get(key)).then(function (r) {
        if (!r || r.value == null) return null;
        try { return JSON.parse(r.value); } catch (e) { return null; }
      }).catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }
  function readLocalJson(key) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function validPair(a) { return Array.isArray(a) && a.length >= 2 && isFinite(a[0]) && isFinite(a[1]); }

  function planSessions(config, now, out) {
    if (!config || typeof config !== 'object') return;
    var cats = [['sessions', 'نشست'], ['killzones', 'کیل‌زون'], ['silverbullets', 'سیلور بولت']];
    var base = nyParts(now);
    cats.forEach(function (cat) {
      var list = Array.isArray(config[cat[0]]) ? config[cat[0]] : [];
      list.forEach(function (ev) {
        if (!ev || (!ev.alarmStart && !ev.alarmEnd)) return;
        for (var off = -1; off <= 3; off++) {
          var day = addDays(base.y, base.m, base.d, off);
          var noon = nyWallToUtc(day.y, day.m, day.d, 12, 0);
          var t = nyParts(noon).dst ? ev.dst : ev.std;
          if (!t || !validPair(t.s) || !validPair(t.e)) continue;
          var startMin = t.s[0] * 60 + t.s[1], endMin = t.e[0] * 60 + t.e[1];
          var endDay = endMin <= startMin ? addDays(day.y, day.m, day.d, 1) : day;
          var startAt = nyWallToUtc(day.y, day.m, day.d, t.s[0], t.s[1]);
          var endAt = nyWallToUtc(endDay.y, endDay.m, endDay.d, t.e[0], t.e[1]);
          var name = ev.name || ev.short || ev.key || '';
          if (ev.alarmStart && startAt > now + 5000 && startAt < now + HORIZON_MS) {
            out.push({ at: startAt, title: 'شروع ' + name, body: cat[1] + ' «' + name + '» شروع شد.', kind: 'session' });
          }
          if (ev.alarmEnd && endAt > now + 5000 && endAt < now + HORIZON_MS) {
            out.push({ at: endAt, title: 'پایان ' + name, body: cat[1] + ' «' + name + '» به پایان رسید.', kind: 'session' });
          }
        }
      });
    });
  }
  function planNews(events, now, out) {
    if (!Array.isArray(events)) return;
    var LEAD = 30 * 1000;
    events.forEach(function (ev) {
      if (!ev || !ev.alarmStart) return;
      var ms = new Date(ev.datetime).getTime();
      if (!isFinite(ms)) return;
      var title = ev.title || '', cur = ev.currency || '';
      if (ms - LEAD > now + 5000 && ms - LEAD < now + HORIZON_MS) {
        out.push({ at: ms - LEAD, title: '۳۰ ثانیه تا خبر: ' + title, body: 'خبر «' + title + '» (' + cur + ') تا ۳۰ ثانیه دیگر اعلام می‌شود.', kind: 'news' });
      }
      if (ms > now + 5000 && ms < now + HORIZON_MS) {
        out.push({ at: ms, title: 'خبر: ' + title, body: 'خبر «' + title + '» (' + cur + ') هم‌اکنون اعلام شد.', kind: 'news' });
      }
    });
  }
  function planMotivation(now, out) {
    var settings = readLocalJson(KEY_MOTIV_SET);
    if (!settings || !settings.enabled) return;
    var messages = readLocalJson(KEY_MOTIV_MSGS);
    var texts = [];
    if (Array.isArray(messages) && messages.length) {
      messages.forEach(function (m) { if (m && typeof m.text === 'string' && m.text.trim()) texts.push(m.text.trim()); });
    } else {
      try { if (typeof NM_MOTIVATION_DEFAULTS !== 'undefined' && Array.isArray(NM_MOTIVATION_DEFAULTS)) texts = NM_MOTIVATION_DEFAULTS.slice(); } catch (e) { }
    }
    if (!texts.length) return;
    var interval = Math.max(60000, Number(settings.intervalMs) || 1800000);
    var at = Number(settings.nextAt) || 0;
    if (at <= now + 5000) at = now + interval;
    var last = -1, count = 0;
    while (at < now + HORIZON_MS && count < MAX_MOTIVATION) {
      var idx = Math.floor(Math.random() * texts.length);
      if (texts.length > 1 && idx === last) idx = (idx + 1) % texts.length;
      last = idx;
      out.push({ at: at, title: MOTIV_TITLE, body: texts[idx], kind: 'motivation' });
      at += interval; count++;
    }
  }
  function buildPlan(now) {
    return Promise.all([readStorageJson(KEY_CONFIG), readStorageJson(KEY_NEWS)]).then(function (res) {
      var out = [];
      planSessions(res[0], now, out);
      planNews(res[1], now, out);
      planMotivation(now, out);
      var textPrefs = readLocalJson(KEY_TEXT_NOTIFS) || {};
      out = out.filter(function (item) {
        var category = item.kind === 'session' ? 'sessions' : item.kind === 'news' ? 'news' : item.kind === 'motivation' ? 'motivation' : null;
        return !category || textPrefs[category] !== false;
      });
      out.sort(function (a, b) { return a.at - b.at; });
      return out.slice(0, MAX_PLAN);
    });
  }

  /* ------------------------------------------------------------------ scheduling */
  function signatureOf(list) {
    return list.map(function (p) { return p.at + '|' + p.title + '|' + (p.kind === 'motivation' ? '' : p.body); }).join('\n');
  }
  function cancelManaged() {
    return call('LocalNotifications', 'getPending').then(function (r) {
      var ids = [];
      ((r && r.notifications) || []).forEach(function (n) {
        if (n && n.id >= PLAN_ID_BASE && n.id < PLAN_ID_LIMIT) ids.push({ id: n.id });
      });
      return ids.length ? call('LocalNotifications', 'cancel', { notifications: ids }) : null;
    }).catch(function () { });
  }
  function scheduleChunks(items) {
    var chain = Promise.resolve();
    for (var i = 0; i < items.length; i += 40) {
      (function (chunk) {
        chain = chain.then(function () { return call('LocalNotifications', 'schedule', { notifications: chunk }); });
      })(items.slice(i, i + 40));
    }
    return chain;
  }
  function sync(force) {
    if (syncing) { syncAgain = syncAgain || !!force; return Promise.resolve(); }
    syncing = true;
    var now = Date.now();
    return refreshPermission().then(function (perm) {
      if (perm !== 'granted') {
        if (plan.length) { plan = []; lastSignature = ''; return cancelManaged(); }
        return null;
      }
      return buildPlan(now).then(function (built) {
        var sig = signatureOf(built);
        if (!force && sig === lastSignature) return null;
        var items = built.map(function (p, i) {
          p.id = PLAN_ID_BASE + i;
          var n = {
            id: p.id, title: p.title, body: p.body, channelId: CH_ALERT, smallIcon: SMALL_ICON,
            schedule: { at: new Date(p.at), allowWhileIdle: true }, extra: { kind: p.kind }
          };
          if (p.body.length > 40) n.largeBody = p.body;
          return n;
        });
        return cancelManaged().then(function () { return scheduleChunks(items); }).then(function () {
          plan = built; lastSignature = sig;
        });
      });
    }).catch(function (e) {
      try { console.warn('[Namello native] schedule sync failed', e); } catch (e2) { }
    }).then(function () {
      syncing = false;
      if (syncAgain) { syncAgain = false; return sync(true); }
    });
  }
  var syncTimer = null;
  function scheduleSync(force) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; sync(!!force); }, 1200);
  }

  /* ------------------------------------------------------------------ status-bar height -> --nm-safe-top */
  function applyTopInset() {
    try {
      if (window.NamelloAndroid && typeof window.NamelloAndroid.getTopInset === 'function') {
        var v = parseFloat(window.NamelloAndroid.getTopInset());
        if (isFinite(v)) document.documentElement.style.setProperty('--nm-safe-top', v + 'px');
      }
    } catch (e) { }
  }

  /* ------------------------------------------------------------------ system bar colour */
  var chromeTimer = null;
  function cssColorToHex(value) {
    try {
      value = String(value || '').trim();
      if (!value) return null;
      var el = document.createElement('div');
      el.style.color = value; el.style.display = 'none';
      document.body.appendChild(el);
      var rgb = getComputedStyle(el).color;
      el.remove();
      var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(rgb);
      if (!m) return null;
      return '#' + [m[1], m[2], m[3]].map(function (n) { return ('0' + parseInt(n, 10).toString(16)).slice(-2); }).join('');
    } catch (e) { return null; }
  }
  function pushChromeColor() {
    try {
      if (!window.NamelloAndroid || typeof window.NamelloAndroid.setChromeColor !== 'function' || !document.body) return;
      var v = getComputedStyle(document.documentElement).getPropertyValue('--bg-card');
      var hex = cssColorToHex(v) || cssColorToHex(getComputedStyle(document.body).backgroundColor);
      if (hex) window.NamelloAndroid.setChromeColor(hex);
    } catch (e) { }
  }
  function scheduleChrome() {
    if (chromeTimer) clearTimeout(chromeTimer);
    chromeTimer = setTimeout(pushChromeColor, 250);
  }

  /* ------------------------------------------------------------------ floating "return to Namello" button */
  // index.html already calls window.NamelloNative.enableFloatingReturn()/disableFloatingReturn();
  // they are mapped to the Android overlay service here (no showNotification on purpose).
  var floatingAdapter = {
    enableFloatingReturn: function () { return !!window.NamelloAndroid.enableFloatingReturn(); },
    disableFloatingReturn: function () { try { window.NamelloAndroid.disableFloatingReturn(); } catch (e) { } }
  };
  try {
    Object.defineProperty(window, 'NamelloNative', {
      configurable: true,
      get: function () {
        return (window.NamelloAndroid && typeof window.NamelloAndroid.enableFloatingReturn === 'function') ? floatingAdapter : undefined;
      }
    });
  } catch (e) { }

  /* ------------------------------------------------------------------ native settings sync */
  var ICON_KEYS = ['default', 'midnight', 'emerald', 'royal', 'graphite', 'sunset', 'ruby'];
  function syncNativeSettings() {
    var A = window.NamelloAndroid;
    if (!A || !window.storage) return;
    readStorageJson('namello_return_fab_settings_v1').then(function (r) {
      try {
        if (r && r.enabled && typeof A.restoreFloatingReturn === 'function') A.restoreFloatingReturn();
        else if (typeof A.disableFloatingReturn === 'function') A.disableFloatingReturn();
      } catch (e) { }
    });
    try {
      Promise.resolve(window.storage.get('namello_navbar_mode_v1')).then(function (r) {
        var m = r && r.value;
        if ((m === 'overlap' || m === 'separate') && typeof A.setNavBarMode === 'function') A.setNavBarMode(m);
      }).catch(function () { });
    } catch (e) { }
    try {
      Promise.resolve(window.storage.get('namello_icon_theme_v1')).then(function (r) {
        var k = r && r.value;
        if (ICON_KEYS.indexOf(k) >= 0 && typeof A.setLauncherIcon === 'function') A.setLauncherIcon(k);
      }).catch(function () { }).then(function () {
        return Promise.resolve(window.storage.get('namello_icon_weekly_v1'));
      }).then(function (r) {
        if (r && (r.value === '1' || r.value === '0') && typeof A.setWeeklyIcon === 'function') A.setWeeklyIcon(r.value === '1');
      }).catch(function () { });
    } catch (e) { }
  }

  /* ------------------------------------------------------------------ downloads (Excel / CSV / JSON ...) */
  // The Android WebView cannot download blob:/data: files (<a download>, SheetJS XLSX.writeFile ...).
  // Every such click is caught here and the file is stored in the public Download folder instead.
  var MIME_BY_EXT = {
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xls: 'application/vnd.ms-excel',
    csv: 'text/csv', json: 'application/json', txt: 'text/plain', md: 'text/markdown', pdf: 'application/pdf',
    html: 'text/html', htm: 'text/html', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', zip: 'application/zip'
  };
  function mimeFor(name, blobType) {
    var ext = String(name || '').split('.').pop().toLowerCase();
    return MIME_BY_EXT[ext] || (blobType && blobType !== 'application/octet-stream' ? blobType : 'application/octet-stream');
  }
  var blobRegistry = {};
  try {
    var origCreate = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function (obj) {
      var u = origCreate(obj);
      try { if (obj instanceof Blob) { blobRegistry[u] = obj; setTimeout(function () { delete blobRegistry[u]; }, 120000); } } catch (e) { }
      return u;
    };
  } catch (e) { }
  var lastSaved = { key: '', t: 0 };
  function saveDownloadedBlob(blob, fileName) {
    var name = String(fileName || 'namello-export');
    var mime = mimeFor(name, blob && blob.type);
    var key = name + '|' + (blob && blob.size);
    if (lastSaved.key === key && Date.now() - lastSaved.t < 3000) return Promise.resolve(true);
    lastSaved = { key: key, t: Date.now() };
    var A = window.NamelloAndroid;
    var viaShare = function () {
      return window.NamelloNativeFiles.shareBlob(blob, name, mime, name).then(function (ok) {
        if (!ok) toast('ذخیره‌ی فایل «' + name + '» انجام نشد.');
        return ok;
      });
    };
    if (!A || typeof A.saveToDownloads !== 'function') return viaShare();
    return blobToBase64(blob).then(function (b64) {
      var res = String(A.saveToDownloads(name, mime, b64));
      if (res.indexOf('ok|') === 0) {
        var parts = res.split('|');
        toast('فایل در پوشه‌ی Download ذخیره شد: ' + parts[1]);
        if (/\.(xlsx|xls|pdf)$/i.test(name) && typeof A.openUri === 'function') { try { A.openUri(parts.slice(2).join('|'), mime); } catch (e) { } }
        return true;
      }
      return viaShare(); // Android 9 or older / write failed -> share sheet
    }).catch(function () { return viaShare(); });
  }
  function handleDownloadAnchor(a) {
    var href = a.href || '';
    if (!/^(blob:|data:)/i.test(href)) return false;
    var name = a.download || 'namello-export';
    var known = blobRegistry[href];
    var pending = known ? Promise.resolve(known) : fetch(href).then(function (r) { return r.blob(); });
    pending.then(function (blob) { return saveDownloadedBlob(blob, name); })
      .catch(function () { toast('ذخیره‌ی فایل انجام نشد.'); });
    return true;
  }
  try {
    var origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      try { if (this.hasAttribute('download') && handleDownloadAnchor(this)) return; } catch (e) { }
      return origClick.apply(this, arguments);
    };
    document.addEventListener('click', function (ev) {
      try {
        var a = ev.target && ev.target.closest ? ev.target.closest('a[download]') : null;
        if (a && handleDownloadAnchor(a)) { ev.preventDefault(); ev.stopPropagation(); }
      } catch (e) { }
    }, true);
  } catch (e) { }

  /* ------------------------------------------------------------------ statement file picker */
  // Android's file picker greys out CSV/Excel files whose MIME type differs from the one derived from
  // accept=".csv,.xlsx,..." (e.g. text/comma-separated-values). The app validates files itself, so the
  // statement inputs are opened without an accept filter inside the Android app.
  try {
    document.addEventListener('click', function (ev) {
      try {
        var t = ev.target;
        if (t && t.tagName === 'INPUT' && t.type === 'file' && /\.csv/i.test(t.getAttribute('accept') || '')) {
          t.setAttribute('accept', '');
        }
      } catch (e) { }
    }, true);
  } catch (e) { }

  /* ------------------------------------------------------------------ files: "open with" sheet */
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var r = new FileReader();
      r.onload = function () { var s = String(r.result || ''); var i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
      r.onerror = function () { reject(r.error || new Error('read-failed')); };
      r.readAsDataURL(blob);
    });
  }
  function safeFileName(name) {
    name = String(name || '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
    return name || 'file';
  }
  window.NamelloNativeFiles = {
    /** Resolves true when the share / open-with sheet was shown (or dismissed by the user). */
    shareBlob: function (blob, fileName, mimeType, title) {
      var safe = safeFileName(fileName);
      return blobToBase64(blob).then(function (b64) {
        return call('Filesystem', 'writeFile', { path: 'namello-shared/' + Date.now() + '-' + safe, data: b64, directory: 'CACHE', recursive: true });
      }).then(function (res) {
        return call('Share', 'share', { title: title || safe, dialogTitle: 'باز کردن با…', url: res.uri });
      }).then(function () { return true; }).catch(function (e) {
        var msg = String((e && (e.message || e)) || '').toLowerCase();
        if (msg.indexOf('cancel') >= 0) return true;
        try { console.warn('[Namello native] share failed', e); } catch (e2) { }
        return false;
      });
    }
  };

  /* ------------------------------------------------------------------ lifecycle */
  window.__nmNativeDebug = function () {
    return { native: true, permission: permission, planned: plan.length, next: plan[0] || null, signature: lastSignature.length };
  };

  refreshPermission().then(function () { scheduleSync(true); });
  applyTopInset();
  window.addEventListener('resize', applyTopInset);
  window.addEventListener('load', function () {
    applyTopInset();
    scheduleChrome();
    try {
      new MutationObserver(scheduleChrome).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
    } catch (e) { }
    setTimeout(function () { scheduleSync(false); syncNativeSettings(); }, 4000);
  });
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { syncNativeSettings(); sync(false); } else { refreshPermission(); scheduleChrome(); scheduleSync(false); }
  });
  window.addEventListener('pagehide', function () { sync(false); });
  window.addEventListener('namello-motivational-settings', function () { scheduleSync(false); });
  window.addEventListener('namello-text-notification-settings', function () { scheduleSync(false); });
  setInterval(function () { if (document.visibilityState !== 'hidden') sync(false); }, 120000);
})();
