
  // بدون این بلوک، فایل sw.js هیچ‌وقت واقعاً فعال نمی‌شد و برنامه‌ی نصب‌شده هیچ‌چیزی
  // رو کش نمی‌کرد — همین، دلیل اصلی اجرا نشدنش بدون اینترنت بود.
  if ('serviceWorker' in navigator) {
    window.addEventListener('pageshow', function () { try { navigator.serviceWorker.getRegistration().then(function(r){ if(r) r.update(); }); } catch(e){} });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').then(function (reg) {
        try { reg.update(); } catch (e) {}
      }).catch(function (err) {
        console.warn('Namello: service worker registration failed', err);
      });
    });
  }
