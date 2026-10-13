// v3: مشکل نسخه‌ی قبل این بود که index.html (که تمام کد برنامه توش inline هست) با استراتژی
// "اول کش" سرو می‌شد — یعنی بعد از اولین بار، حتی وقتی اینترنت وصل بود و نسخه‌ی جدیدی روی
// هاست آپلود شده بود، سرویس‌ورکر همچنان همون نسخه‌ی قدیمیِ کش‌شده رو نشون می‌داد و کاربر آخرین
// تغییرات رو نمی‌دید.
// این نسخه، استراتژی رو برای خودِ index.html به "اول شبکه" (network-first) تغییر داده: هر بار
// که اینترنت وصله، همیشه نسخه‌ی تازه از سرور گرفته و نشون داده می‌شه (و همون نسخه هم برای
// دفعات آفلاینِ بعدی کش می‌شه). فقط وقتی واقعاً آفلاینیم، از کش قدیمی استفاده می‌شه.
// برای فایل‌های CDN (React, XLSX, Plotly, Tailwind, فونت‌ها) که نسخه‌شون پین‌شده و عوض نمی‌شه،
// همچنان استراتژی "اول کش" (سریع‌تر و برای آفلاین قابل‌اعتمادتر) باقی مونده.
// نام کش به نسخه‌ی برنامه گره خورده (Namello 1.0.4 / Version Code 71)؛ با هر آپدیت این را عوض کن.
const CACHE_NAME = "namello-1.0.4-c71";

const HTML_URLS = ["./", "./index.html"];
const WIDGET_URL = "./widget.html";
const APP_SHELL = ["./manifest.json", "./manifest-midnight.json", "./manifest-emerald.json", "./manifest-royal.json", "./manifest-graphite.json", "./manifest-sunset.json", "./manifest-ruby.json", "./icon-192.png", "./icon-512.png", "./icon-mt5.jpg", "./icon-tradingview.png", "./icon-dashboard-logo.png", "./icon-sessions.png", "./icon-journal.png", "./icon-journal-192.png", "./icon-journal-512.png", "./logos/01-evaluation.png", "./logos/02-psychology.png", "./logos/03-sessions-and-events.png", "./logos/04-news.png", "./logos/05-motivation.png", WIDGET_URL];

// آیکون‌های تم‌های آیکون (اختیاری؛ اگر یکی نبود نصب شکست نمی‌خورد)
const OPTIONAL_LOCAL = ["./version.json", "./native-bridge.js", "./icon-day-sat.jpg", "./icon-day-sun.jpg", "./icon-day-mon.jpg", "./icon-day-tue.jpg", "./icon-day-wed.jpg", "./icon-day-thu.jpg", "./icon-day-fri.jpg", "./icon-midnight-192.png", "./icon-emerald-192.png", "./icon-royal-192.png", "./icon-graphite-192.png", "./icon-sunset-192.png", "./icon-ruby-192.png"];

const RUNTIME_DEPS = [
  "https://cdn.jsdelivr.net/npm/react@18/umd/react.production.min.js",
  "https://cdn.jsdelivr.net/npm/react-dom@18/umd/react-dom.production.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.32.0/plotly.min.js",
  "https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4",
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700;800&family=Estedad:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@400;500;600;700&family=Noto+Sans+Arabic:wght@400;500;600;700&family=Cairo:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      // پوسته‌ی برنامه: اگه هرکدوم شکست بخوره، نصب باید شکست بخوره (این‌ها حیاتی و محلی‌ان)
      await cache.addAll([...HTML_URLS, ...APP_SHELL]);
      // وابستگی‌های CDN: هرکدوم جدا کش می‌شن تا اگه یکی‌شون (مثلاً به‌خاطر فیلترینگ یه دامنه)
      // شکست خورد، بقیه همچنان کش بشن و برنامه تا حد امکان آفلاین کار کنه.
      await Promise.allSettled(OPTIONAL_LOCAL.map((u) => cache.add(u)));
      await Promise.allSettled(
        RUNTIME_DEPS.map((url) =>
          fetch(url, { mode: "cors" })
            .then((res) => { if (res && (res.ok || res.type === "opaque")) return cache.put(url, res); })
            .catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      // Keep only the current Namello cache. Older caches can contain an outdated
      // manifest (for example an older app version) and caches.match() may otherwise
      // return that stale manifest before the newly deployed one.
      return Promise.all(keys.filter((k) => k.startsWith('namello-') && k !== CACHE_NAME).map((k) => caches.delete(k)));
    })
  );
  self.clients.claim();
});

// دکمه‌ی «بازگشت به Namello»: وقتی برنامه پس‌زمینه می‌شه (طبق تنظیمات کاربر در تب «تنظیمات»)،
// یک نوتیفیکیشن نشون داده می‌شه؛ با تپ روی خودِ نوتیفیکیشن، اگه یه تب/پنجره‌ی Namello باز باشه
// فوکوس می‌گیره، وگرنه یه پنجره‌ی جدید باز می‌شه.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./index.html");
    })
  );
});

function isAppShellHtml(request) {
  if (request.mode === "navigate") return true;
  const url = new URL(request.url);
  return url.origin === self.location.origin && (url.pathname.endsWith("/index.html") || url.pathname.endsWith("/") || url.pathname.endsWith("/widget.html") || url.pathname.endsWith("/version.json"));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (isAppShellHtml(req)) {
    // network-first: همیشه اول نسخه‌ی تازه رو از سرور بگیر (اگه اینترنت هست)، کش رو هم به‌روز کن.
    // فقط وقتی شبکه واقعاً در دسترس نیست، از آخرین نسخه‌ی کش‌شده استفاده کن.
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  // بقیه (کتابخانه‌های CDN پین‌شده، آیکون‌ها، مانیفست): اول کش، سریع‌تر و برای آفلاین مطمئن‌تر.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === "opaque")) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch((err) => { throw err; });
    })
  );
});
