
  // تا وقتی برنامه هنوز mount نشده، هر خطایی واقعاً کشنده‌ست (چون یعنی اصلاً بالا نیومده) و باید
  // صفحه‌ی کامل خطا رو نشون بدیم. اما بعد از mount موفق، یک خطای بعدی (حتی اگه از دل یه فیچر فرعی
  // باشه) نباید کل UIِ درحال‌کارِ کاربر رو پاک کنه — به‌جاش یک نوار کوچیک پایین صفحه نشون می‌دیم که
  // می‌شه بستش، و کار با بقیه‌ی برنامه ادامه پیدا می‌کنه.
  window.__namelloMounted = false;
  // اعمال زودهنگام تم (قبل از رندر) تا هنگام باز شدن برنامه، لحظه‌ای رنگ پیش‌فرض دیده نشود.
  (function () {
    try {
      var d = document.documentElement;
      var m = localStorage.getItem('ns_namello_theme_mode_v1');
      var t = localStorage.getItem('ns_namello_app_theme_v1');
      if (m === 'light' || m === 'dark') d.setAttribute('data-theme', m);
      if (t && t !== 'classic') d.setAttribute('data-app-theme', t);
    } catch (e) {}
  })();
  function showBootError(title, detail) {
    if (window.__namelloMounted) {
      showRuntimeErrorBanner(title, detail);
      return;
    }
    var el = document.getElementById('boot-error');
    var status = document.getElementById('boot-status');
    if (status) status.style.display = 'none';
    if (!el) return;
    el.style.display = 'block';
    var looksLikeCorruptedLib = /react|xlsx|plotly|tailwind/i.test(String(detail || '')) && /is not a function|is not defined|Unexpected token/i.test(String(detail || ''));
    var hint = looksLikeCorruptedLib
      ? 'این نوع خطا معمولاً یعنی یکی از فایل‌های جاوااسکریپتِ برنامه (از cdn.jsdelivr.net) به‌طور کامل دانلود نشده — رایج‌ترین دلیلش اینترنت ناپایداره. لطفاً یه بار دکمه‌ی «تلاش مجدد» رو بزن؛ اگه دوباره تکرار شد، با وای‌فای امتحان کن.'
      : '';
    el.innerHTML = '';
    var pre = document.createElement('div');
    pre.textContent = '⚠ ' + title + '\n\n' + (detail || '') + (hint ? ('\n\n' + hint) : '') + '\n\n---\nPlease screenshot this and send it back.';
    el.appendChild(pre);
    var btn = document.createElement('button');
    btn.textContent = 'تلاش مجدد (بارگذاری دوباره)';
    btn.style.cssText = 'margin-top:16px; padding:10px 16px; border-radius:10px; background:#D4A64A; color:#0B0E11; border:none; font-family:inherit; font-size:12px; cursor:pointer;';
    btn.onclick = function () { window.location.reload(); };
    el.appendChild(btn);
  }
  var runtimeBannerTimer = null;
  function showRuntimeErrorBanner(title, detail) {
    var banner = document.getElementById('runtime-error-banner');
    if (!banner) return;
    banner.innerHTML = '';
    var span = document.createElement('span');
    span.textContent = '⚠ ' + title + ': ' + String(detail || '').slice(0, 160);
    banner.appendChild(span);
    var closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'margin-inline-start:10px; background:none; border:none; color:#F87171; font-size:14px; cursor:pointer;';
    closeBtn.onclick = function () { banner.style.display = 'none'; };
    banner.appendChild(closeBtn);
    banner.style.display = 'block';
    console.error('[Namello runtime error, app still mounted]', title, detail);
    if (runtimeBannerTimer) clearTimeout(runtimeBannerTimer);
    runtimeBannerTimer = setTimeout(function () { banner.style.display = 'none'; }, 8000);
  }
  window.addEventListener('error', function (e) {
    var msg = e.message || (e.error && (e.error.stack || e.error.message)) || 'Unknown error';
    var src = e.filename ? (' at ' + e.filename + ':' + e.lineno + ':' + e.colno) : '';
    showBootError('Script error', msg + src);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    showBootError('Unhandled promise rejection', (e.reason && (e.reason.stack || e.reason.message)) || String(e.reason));
  });

  /* ================= Namello Storage v2 =================
     پیش‌تر همه‌ی داده (معاملات، عکس/صدای یادداشت‌ها، تنظیمات) در localStorage بود که سقفش حدود ۵ مگابایت است
     و پر شدنش بی‌صدا باعث ذخیره‌نشدن می‌شد. حالا داده‌ها در IndexedDB نگه‌داری می‌شوند (ظرفیت صدها مگابایت)،
     با مهاجرت خودکار و بازبینی‌شده از localStorage قدیمی. اگر IndexedDB در دسترس نبود، به همان رفتار قبلی برمی‌گردد.
     چند کلیدِ کوچک (تم و پیکربندی رویدادها) عمداً در localStorage هم آینه می‌شوند، چون قبل از بالا آمدن React
     (جلوگیری از پرش رنگ) و توسط widget.html به‌صورت همگام خوانده می‌شوند. */
  (function () {
    var PREFIX = 'ns_';
    var MIRROR = { namello_theme_mode_v1: 1, namello_app_theme_v1: 1, namello_icon_theme_v1: 1, namello_session_config_v3: 1 };
    var LS_ONLY = { namello_seen_version_code_v1: 1, namello_update_from_v1: 1 };   // مخصوص همین دستگاه؛ مهاجرت نمی‌شوند
    var DB_NAME = 'namello_store', STORE = 'kv', META = '__meta__';
    var backend = 'localStorage';
    var lastWarn = 0;

    function warn(msg) {
      var now = Date.now();
      if (now - lastWarn < 10000) return;
      lastWarn = now;
      try { window.dispatchEvent(new CustomEvent('namello-toast', { detail: msg })); } catch (e) {}
    }
    var FULL_MSG = 'ذخیره‌سازی ناموفق بود؛ فضای حافظه‌ی برنامه پر است. همین حالا از تنظیمات ← پشتیبان‌گیری فایل پشتیبان بگیرید.';

    /* ---------- پیاده‌سازی قدیمی (localStorage) ---------- */
    var ls = {
      async get(key) { var raw = localStorage.getItem(PREFIX + key); if (raw === null) throw new Error('not found'); return { key: key, value: raw, shared: false }; },
      async set(key, value) {
        try { localStorage.setItem(PREFIX + key, value); } catch (e) { warn(FULL_MSG); throw e; }
        return { key: key, value: value, shared: false };
      },
      async delete(key) { localStorage.removeItem(PREFIX + key); return { key: key, deleted: true, shared: false }; },
      async list(prefix) {
        var keys = [];
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (k && k.indexOf(PREFIX + (prefix || '')) === 0 && !LS_ONLY[k.slice(3)]) keys.push(k.slice(3));
        }
        return { keys: keys, shared: false };
      },
    };

    /* ---------- IndexedDB ---------- */
    var db = null;
    function openDb() {
      return new Promise(function (resolve, reject) {
        if (!window.indexedDB) { reject(new Error('no-idb')); return; }
        var rq;
        try { rq = indexedDB.open(DB_NAME, 1); } catch (e) { reject(e); return; }
        rq.onupgradeneeded = function () { if (!rq.result.objectStoreNames.contains(STORE)) rq.result.createObjectStore(STORE); };
        rq.onsuccess = function () { resolve(rq.result); };
        rq.onerror = function () { reject(rq.error); };
        rq.onblocked = function () { reject(new Error('idb-blocked')); };
      });
    }
    function run(mode, fn) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode), st = tx.objectStore(STORE), out;
        try { out = fn(st); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { resolve(out && out.result !== undefined ? out.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('tx-aborted')); };
      });
    }
    function setMirror(key, value) { if (MIRROR[key]) { try { localStorage.setItem(PREFIX + key, value); } catch (e) {} } }
    var idb = {
      async get(key) {
        var v = await run('readonly', function (s) { return s.get(key); });
        if (v === undefined) throw new Error('not found');
        return { key: key, value: v, shared: false };
      },
      async set(key, value) {
        try { await run('readwrite', function (s) { return s.put(String(value), key); }); }
        catch (e) { warn(FULL_MSG); throw e; }
        setMirror(key, String(value));
        return { key: key, value: value, shared: false };
      },
      async delete(key) {
        await run('readwrite', function (s) { return s.delete(key); });
        if (MIRROR[key]) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} }
        return { key: key, deleted: true, shared: false };
      },
      async list(prefix) {
        var all = await run('readonly', function (s) { return s.getAllKeys(); });
        var p = prefix || '';
        return { keys: (all || []).filter(function (k) { return k !== META && String(k).indexOf(p) === 0; }), shared: false };
      },
    };

    /* ---------- مهاجرت localStorage → IndexedDB (با بازبینی مقدار به مقدار) ---------- */
    async function migrate() {
      var meta = await run('readonly', function (s) { return s.get(META); });
      if (meta && meta.migrated) return meta;
      var legacy = {}, n = 0;
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(PREFIX) === 0 && !LS_ONLY[k.slice(3)]) { legacy[k.slice(3)] = localStorage.getItem(k); n++; }
      }
      if (n) {
        await run('readwrite', function (s) { Object.keys(legacy).forEach(function (key) { s.put(legacy[key], key); }); });
        // بازبینی: همه‌ی مقدارها باید عیناً برگردند، وگرنه هیچ‌چیز از localStorage پاک نمی‌شود
        for (var key in legacy) {
          var back = await run('readonly', function (s) { return s.get(key); });
          if (back !== legacy[key]) throw new Error('verify-failed:' + key);
        }
        Object.keys(legacy).forEach(function (key) { if (!MIRROR[key]) { try { localStorage.removeItem(PREFIX + key); } catch (e) {} } });
      }
      meta = { migrated: true, at: new Date().toISOString(), count: n, schema: 1 };
      await run('readwrite', function (s) { return s.put(meta, META); });
      return meta;
    }

    var info = { backend: 'localStorage', migratedAt: null, migratedCount: 0, error: null };
    var api = {
      get: function (k) { return ready.then(function () { return (backend === 'idb' ? idb : ls).get(k); }); },
      set: function (k, v) { return ready.then(function () { return (backend === 'idb' ? idb : ls).set(k, v); }); },
      delete: function (k) { return ready.then(function () { return (backend === 'idb' ? idb : ls).delete(k); }); },
      list: function (p) { return ready.then(function () { return (backend === 'idb' ? idb : ls).list(p); }); },
      info: function () { return ready.then(function () { return info; }); },
      /* حجم هر آیتم (بایتِ تقریبی)، مرتب از بزرگ به کوچک — برای صفحه‌ی «فضای ذخیره‌سازی» */
      sizes: function () {
        return ready.then(async function () {
          var out = [];
          if (backend === 'idb') {
            await run('readonly', function (s) {
              var rq = s.openCursor();
              rq.onsuccess = function () { var c = rq.result; if (c) { if (c.key !== META) out.push({ key: c.key, size: String(c.value).length * 2 }); c.continue(); } };
              return rq;
            });
          } else {
            for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0 && !LS_ONLY[k.slice(3)]) out.push({ key: k.slice(3), size: (localStorage.getItem(k) || '').length * 2 }); }
          }
          out.sort(function (a, b) { return b.size - a.size; });
          return out;
        });
      },
      estimate: async function () {
        var res = { usage: 0, quota: 0, persisted: null };
        try { if (navigator.storage && navigator.storage.estimate) { var e = await navigator.storage.estimate(); res.usage = e.usage || 0; res.quota = e.quota || 0; } } catch (e) {}
        try { if (navigator.storage && navigator.storage.persisted) res.persisted = await navigator.storage.persisted(); } catch (e) {}
        if (backend !== 'idb') { var used = 0; (await api.sizes()).forEach(function (x) { used += x.size; }); res.usage = used; res.quota = 5 * 1024 * 1024; }
        return res;
      },
      requestPersist: async function () { try { return !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) { return false; } },
    };

    var ready = (async function () {
      try {
        db = await openDb();
        await run('readwrite', function (s) { s.put('1', '__probe__'); });          // تست واقعی قابل‌نوشتن بودن
        await run('readwrite', function (s) { s.delete('__probe__'); });
        var meta = await migrate();
        backend = 'idb'; info.backend = 'idb'; info.migratedAt = meta.at; info.migratedCount = meta.count;
        // کلیدهای آینه‌شده باید در localStorage هم باشند (اگر پاک شده باشند دوباره ساخته می‌شوند)
        var keys = (await idb.list('')).keys;
        for (var i = 0; i < keys.length; i++) { if (MIRROR[keys[i]]) { var v = await run('readonly', function (s) { return s.get(keys[i]); }); if (v !== undefined) setMirror(keys[i], v); } }
        try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
      } catch (e) {
        backend = 'localStorage'; info.backend = 'localStorage'; info.error = String((e && e.message) || e);
        try { console.warn('Namello: IndexedDB unavailable, using localStorage', e); } catch (e2) {}
      }
    })();
    window.storageReady = ready;
    window.storage = api;
  })();
