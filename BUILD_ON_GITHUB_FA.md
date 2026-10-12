# ساخت APK نامللو در GitHub Actions

محتویات این zip باید **مستقیماً در ریشه‌ی repository** قرار بگیرند (`.github`، `package.json`، `index.html`، `native`، `scripts` …).

## ساخت APK
1. همه‌ی فایل‌ها را در repository بگذارید (فایل‌های قدیمی را بازنویسی کنید).
2. Actions ← **Namello Android Debug APK** (آزمایشی) یا **Namello Signed Release APK** (امضاشده؛ نیازمند Secrets: `ANDROID_KEYSTORE_BASE64`، `ANDROID_KEYSTORE_PASSWORD`، `ANDROID_KEY_ALIAS`) ← **Run workflow**.
3. بعد از اجرای سبز، از **Artifacts** فایل `Namello-<نسخه>-Android-APK` را بگیرید.

## ترتیب مراحل (هر مرحله اگر شکست بخورد، پیام مشخص می‌دهد)
`verify` (هماهنگی نسخه) ← `npm test` ← `typecheck` ← `build` (dist/) ← `cap add android` ← `configure-android` (نسخه، مجوزها، MainActivity، آیکن) ← `cap sync` ← `gradle assembleDebug`.

## بالا بردن نسخه (دیگر هیچ‌جا دستی عوض نکنید)
```
node scripts/bump-version.mjs 1.0.35        # versionCode خودکار +1
```
سپس متن تغییرات را در `NM_CHANGELOG` داخل `index.html` بنویسید و commit کنید. `version.json` تنها منبع نسخه است؛ تست‌ها و `verify` از همان می‌خوانند.

## نکته‌ها
- build وب با `scripts/build-web.mjs` انجام می‌شود (کپی مستقیم بدون bundler). مسیر Vite با `npm run build:vite` در دسترس است.
- بعد از اولین اجرای موفق، فایل `package-lock.json` را commit کنید؛ از آن به بعد workflow با `npm ci` دقیقاً همان نسخه‌ها را نصب می‌کند.
- خروجی فعلی debug است؛ برای فروشگاه باید کلید release در GitHub Secrets تنظیم شود.
- Backend مستقل است و نسخه‌ی `backend/package.json` عمداً جدا می‌ماند.
