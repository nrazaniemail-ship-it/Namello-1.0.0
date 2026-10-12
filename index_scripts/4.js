
  // If a required CDN library hangs instead of firing onerror, never leave a blank screen.
  window.__namelloBootWatchdog = setTimeout(function () {
    if (!window.__namelloMounted && typeof React === 'undefined') {
      showBootError('Namello هنوز اجرا نشده', 'کتابخانه اصلی React از شبکه/کش بارگذاری نشده است. یک بار تلاش مجدد را بزنید؛ در صورت تکرار، کش سایت را پاک و دوباره وارد شوید.');
    }
  }, 12000);
