# Namello 1.0.3 — Version Code 70

- ساعت نشست‌ها بزرگ‌تر و قطورتر شد؛ ارقام ساعت به داخل حلقه منتقل شدند و اندازهٔ دقیقه‌ها و عنوان قطاع‌ها افزایش یافت تا هم‌پوشانی کاهش یابد.
- راهنمای فعال‌سازی پیکربندی‌های ذخیره‌شدهٔ فیلدهای سفارشی ژورنال روشن‌تر شد و دکمه‌ها برای هر فرم مستقل مشخص شدند.
- عنوان بخش توصیه‌ها در ارزیابی پیشرفته و روانشناسی ترید یکسان شد.
- تنظیمات مستقل نوتیفیکیشن‌های متنی، آیکون‌های پنج دسته و زمان‌بندی هشدار اخبار ۳۰ ثانیه پیش از رویداد در وب/APK حفظ و آزمون شدند.
- آزمون‌های خودکار، بررسی نسخه، ساخت وب و TypeScript typecheck اجرا شدند. ساخت و آزمایش APK روی دستگاه واقعی هنوز لازم است.

## 1.0.1 (Version Code 68) — versioned source refresh
- Synced version metadata across the source, PWA manifests, service worker, and package metadata.
- Preserved the existing backup/restore safeguards, Android Back handling, custom-field profiles, notification scheduling/artwork, and weekly icon assets.
- Automated verification: 98 tests pass; TypeScript typecheck and web build pass. Real-device APK validation remains outstanding.

## 1.0.0 (Version Code 67) — consolidated release
- Includes the latest Namello working source, Android backup/restore safeguards, notification category artwork, and Android Back handling changes carried forward from the 1.0.67 development line.
- Version Name is reset to the requested 1.0.0; Android versionCode remains incremented to 67 so Android does not treat this package as an older build.

## 1.0.67 (Version Code 66)
- A Back press consumed by a dialog or sub-page now resets the main-page double-Back exit timer, preventing an unexpected exit after closing an overlay.

## 1.0.61 (Version Code 60)
- Android Back handling now has a bounded WebView callback timeout and guards against overlapping rapid presses, so a stalled JavaScript callback does not leave the system Back button unresponsive.

## 1.0.60 (Version Code 59)
- Android backup folder selection now verifies persisted read/write SAF permissions before saving the folder; permission/provider failures are reported separately from user cancellation.

## 1.0.59 (Version Code 58)
- Explicit notification kind/category metadata now takes priority over title/body keyword matching, preventing cross-category logo selection when notification text mentions another topic.

## 1.0.54 (Version Code 53)
- Notification artwork selection now checks structured category/kind metadata and common English/Persian labels before falling back to title/body text.

## 1.0.53 (Version Code 52)
- Android SAF backup folders now prune old automatic JSON backups and retain the newest configured number (default 8), just like the default Downloads destination.

## 1.0.50 (Version Code 49)
- Added named custom-field profiles and Namello/Raw/Custom mode controls; raw mode hides custom fields without deleting historical trade values.
- Added category-specific large notification artwork mapping for Android (evaluation, psychology, sessions, news, motivation).
- Kept Android folder-picker backup support and ordered Back handling from 1.0.49.

## 1.0.47 (versionCode 46)
- رفع خطای Excel («Sheet name cannot contain : \\ / ? * [ ]»): نام شیت‌های دوزبانه ایمن شد (nmSafeSheetName).
- رفع PDF در APK: تایمر روی WebView جداشده اجرا نمی‌شد → Handler اصلی؛ خطاها در صفحه نمایش داده می‌شوند.
- پشتیبان خودکار هفتگی در APK: Download/Namello-Backups، نگه‌داری ۸ فایل، پیشنهاد فعال‌سازی و یادآوری ۱۴ روزه.
- قفل برنامه: PIN (PBKDF2) + BiometricPrompt + زمان قفل + FLAG_SECURE.
- ماشین‌حساب ریسک و سقف ضرر روزانه (مبلغ/درصد، حداکثر معامله، ضرر متوالی) با نوار هشدار و اعلان.
- تصاویر جدید آیکون هفتگی.

## 1.0.46 (versionCode 45)
- دکمه‌ی شناور: تغییر نام بخش، حذف نوتیفیکیشن دائمی (سرویس معمولی بدون Foreground)، به‌روزرسانی متن‌های راهنما.
- تم آیکون: زیربخش «تم آیکون سفارشی ثابت» + «تم آیکون متغیر هفتگی» (۷ تصویر روزهای هفته؛ 14 activity-alias؛ DailyIconReceiver برای تعویض نیمه‌شب).

## 1.0.45 (versionCode 44)
- استیتمنت: تشخیص کدگذاری UTF-16/UTF-8/Windows-1256 برای HTML (گزارش MT5).
- APK: ورودی‌های فایل استیتمنت بدون فیلتر accept باز می‌شوند.

## 1.0.44 (versionCode 43)
- APK: دانلود blob:/data: (Excel، CSV، JSON، پشتیبان) → MediaStore Downloads + باز کردن Excel/PDF.
- APK: خروجی PDF با PrintManager (Save as PDF).
- سربرگ PDF: نسخه‌ی واقعی به‌جای 1.0.26.

## 1.0.43 (versionCode 42)
- دکمه‌ی شناور: حذف حلقه و padding؛ آیکون = آیکون لانچر تم انتخابی (refreshIcon).

## 1.0.42 (versionCode 41)
- APK: setLauncherIcon به MainActivity برگشت (تعویض activity-alias آیکون لانچر).
- APK: FloatingReturnService — دکمه‌ی شناور روی سایر برنامه‌ها (SYSTEM_ALERT_WINDOW + foreground service).

## 1.0.41 (versionCode 40)
- APK: اجرای سریع MT5/TradingView با PackageManager (launchApp) + بلوک <queries> در مانیفست.
- دکمه‌ی تیره/روشن: بالا-وسط صفحه.
- هدر: فاصله‌ی بیشتر از نوار وضعیت (--nm-safe-top).
- عنوان لایه‌ها: حذف باکس زمینه (background/border شفاف؛ اندازه و محتوا بدون تغییر).

## 1.0.40 (versionCode 39)
- تنظیمات ← Navigation bar: حالت «تداخل» (تمام‌صفحه) و «جدایش» (پیش‌فرض)؛ ذخیره در برنامه و اعمال بومی در MainActivity.

## 1.0.37 (versionCode 38)
- MainActivity حداقلی: فقط padding insets (چپ/راست/پایین) + CONSUMED برای رفع تداخل با Navigation bar.

## 1.0.36 (versionCode 37)
- MainActivity بازطراحی کامل: padding چپ/راست/پایین با insets سیستم + کیبورد و CONSUMED (بدون دوباره‌کاری)، edge-to-edge یکسان برای همه‌ی نسخه‌های اندروید، ارتفاع نوار وضعیت به‌صورت --nm-safe-top به صفحه.

## 1.0.35 (versionCode 36)
- APK: اعلان «بازگشت به Namello» بومی (MainActivity.onStop/onStart).
- تنظیمات: فلش‌های «ترتیب لایه‌ها» نارنجی (#F59E0B).
- APK: تم آیکون → تعویض آیکون لانچر با activity-alias (۷ تم).
- ویجت: دکمه‌ی برگشت پایین‌راست + پشتیبانی از دکمه‌ی Back اندروید.

## 1.0.34 (versionCode 35)
- APK: نوار لایه‌ها دیگر زیر Navigation bar نمی‌رود (padding بومی برای insets و کیبورد).
- APK: دکمه‌ی Back ابتدا پنجره/لایه را می‌بندد، سپس به نشست‌ها برمی‌گردد و فقط با دو بار زدن خارج می‌شود.
- APK: اعلان‌های نشست‌ها، اخبار و پیام انگیزشی با اعلان بومی (Local Notifications)؛ زمان‌بندی ۳۶ ساعت آینده حتی وقتی برنامه بسته است.
- APK: کتابخانه — فایل متنی داخل برنامه باز می‌شود، سایر فایل‌ها با منوی «باز کردن با…».
- Build: `verify-namello-version.mjs` و تست‌ها از `version.json` می‌خوانند؛ `bump-version.mjs` اضافه شد؛ build وب بدون bundler؛ `configure-android.mjs` جایگزین `set-android-version.mjs`.

# Namello 1.0.29
- یکدست‌سازی شماره نسخه و کد نسخه در فایل برنامه، فایل‌های PWA و اطلاعات انتشار؛ کد نسخه به 30 افزایش یافت.
- اصلاح نام کش Service Worker به `namello-1.0.29-c30` برای جلوگیری از استفاده ناخواسته از پوسته‌ی کش‌شده‌ی قدیمی.
- قابلیت‌های نسخه 1.0.28 (سه بازوی هوش مصنوعی داشبورد) حفظ شده‌اند.
- بررسی: 27 تست و TypeScript typecheck موفق؛ ساخت Vite به‌دلیل نبودن بسته‌ی Vite و قطع دسترسی شبکه در محیط بررسی قابل اجرا نبود.

# Namello 1.0.27
- فقط لایه ژورنال: تغییرات آیتم‌های ثبت ورود و ثبت نتیجه معامله طبق درخواست کاربر.

# Namello 1.0.26

- ثبت نتیجه معامله: دکمه «ثبت نهایی» با زمینه‌ی زرد کم‌رنگ (#FEF3C7).
- ممیزی رنگ‌بندی: ۱۶ ترکیب تم (۸ تم × تیره/روشن) با معیار WCAG ۲٫۱ سنجیده و اصلاح شد: متن اصلی ≥ 11.8:1، متن فرعی ≥ 6.6:1، متن کم‌رنگ و رنگ تأکیدی ≥ 4.5:1 روی همه‌ی زمینه‌ها.
- توکن‌های رنگ معنایی (`--c-success/danger/warning/info/accent2`) و اصلاح خودکار رنگ متن‌های سبز/قرمز/زرد/آبی/بنفش در تم روشن (قبلاً کنتراست 1.7 تا 2.8) و بنفش/آبی کم‌کنتراست در تم تیره؛ پس‌زمینه‌ها دست‌نخورده.
- حاشیه‌ی کارت‌ها در تم‌های تیره ≥ 1.45:1 نسبت به کارت.
- تست جدید قرارداد کنتراست رنگ‌ها.
- یکدست‌سازی شماره نسخه در همه‌ی بخش‌ها (1.0.26 / Version Code 27).

## 1.0.25 — Sell Support & Pending Orders

- پردازش تصویر چارت (آیتم ۳۶): پشتیبانی از معاملات فروش؛ کادر و خط ورود قرمز (فروش) علاوه بر آبی (خرید)، با SL نارنجی و TP سبز.
- جهت معامله از موقعیت TP/SL تشخیص داده می‌شود؛ R-multiple و ریسک دلاری برای فروش هم محاسبه می‌شود.
- ثبت ورود: آیتم جدید «سفارش شرطی» (آیتم ۳۴) با چهار حالت Buy Limit / Buy Stop / Sell Limit / Sell Stop در دو ستون سبز و قرمز؛ تک‌انتخابی و قابل ویرایش. شماره‌ی آیتم‌های بعدی یکی افزایش یافت (هم‌راستایی ۳۵، تصویر چارت ۳۶، ارزیابی صوتی ۳۷).
- ثبت ورود: کادر دکمه «خرید» سبز و «فروش» قرمز (آیتم ۳۳).
- ثبت ورود: مقدار ریسک (آیتم ۲۶) فقط داخل باکس مقدار؛ ورودی تکراری زیر آن حذف شد.
- یکدست‌سازی شماره نسخه در همه‌ی بخش‌ها (1.0.25 / Version Code 26).

## 1.0.24 — UI Fixes

- دکمه بروزرسانی اخبار اقتصادی: لوگوی متحرک با تصویر جدید بازطراحی شد (لایه‌های بدنه، شانه+ساعد نزدیک و دور، دم، خطوط سرعت و پلک).
- ارزیابی پیشرفته داشبورد: راهنمای هر بخش با سه‌نقطه‌ی عمودی داخل باکس چهارگوش، دقیقاً سمت راست عنوان.
- پلیر پادکست: دکمه‌های قبلی/بعدی در لایه‌های غیر از کتابخانه کار می‌کنند؛ صف پخش در صورت نبودن از کتابخانه بازسازی می‌شود.
- هدر برنامه: نام برنامه با فونت 12 و نسخه با فونت 6 به‌صورت توان؛ تاریخ میلادی کنار تاریخ شمسی در یک سطر.
- یکدست‌سازی شماره نسخه در همه‌ی بخش‌ها (1.0.24 / Version Code 25).

## 1.0.23 — Chart Vision

- افزودن دکمه «پردازش تصویر» (با کلید فعال/غیرفعال) در ثبت ورود، زیر «چارت تایم ورود - شروع» (آیتم ۳۵).
- خواندن آفلاین قیمت‌های روی محور قیمت چارت MT5 موبایل: کادر آبی (ورود)، سبز (TP) و نارنجی (SL) با پردازش تصویر و تطبیق قالب ارقام، بدون کتابخانه یا سرور خارجی.
- اعتبارسنجی مقادیر با کالیبراسیون محور قیمت و هشدار در صورت ناهم‌خوانی یا دقت پایین.
- پر شدن خودکار قیمت ورود (آیتم ۲۷)، R-multiple (آیتم ۲۵) و ریسک دلاری (آیتم ۲۶) بر اساس لات آیتم ۲۸ و مقدار پیپ/ارزش پیپ هر نماد.
- یکدست‌سازی شماره نسخه در تمام بخش‌های برنامه (1.0.23 / Version Code 24).

## 1.0.22 — Advanced Evaluation Redesign

- بازطراحی ارزیابی پیشرفته داشبورد به ۶ بخش مستقل و شماره‌گذاری‌شده با جمع/بازشدن جداگانه.
- راهنمای کامل مکانیزم، اصطلاحات، نحوه تفسیر و نکات هر بخش با دکمه سه‌نقطه کنار عنوان.
- چیدمان موتورهای تحلیل استراتژیک در دو سطر با نام کامل هر موتور داخل باکس.

## 1.0.21 — Strategic LLM Copilot

- افزودن LLM Copilot روی خروجی ساختاریافته موتور Rule-Based.
- حالت Backend امن با نگهداری کلید در سرور و حالت Direct اختیاری.
- خروجی JSON شامل خلاصه، Regime/Transition، Edge، Risk، Strategy، Psychology، اقدامات، هشدارها و Confidence.
- داده خام معاملات و یادداشت‌های شخصی به‌صورت پیش‌فرض به LLM ارسال نمی‌شوند.
- LLM فقط تفسیرکننده است؛ محاسبات اصلی و تصمیم‌گیری پایه همچنان Rule-Based و قابل ردیابی می‌مانند.

## 1.0.20 — Adaptive Rule-Based Strategic Engine
- Regime Transition, Forecast, Conditional Risk, Strategy Fit, Adaptive Decay, Regime × Psychology, Decision Center.

## 1.0.12 — OHLC/MT5 Regime Detection

- افزودن تشخیص رژیم بازار مبتنی بر مسیر OHLC متصل‌شده از MT5.
- Volatility Regime نسبی Low / Medium / High با صدک‌های 33/66.
- Trend / Range با Efficiency Ratio و کمک Autocorrelation(1).
- رژیم ترکیبی Volatility × Trend و Conditional Edge برای هر رژیم.
- نمایش پوشش OHLC، منبع داده، آستانه‌ها و محدودیت نمونه برای Explainability.
- افزایش Version Code به 13.

# Changelog

## 1.0.11 — Strategic Analysis Engine Upgrade
- ارتقای موتور تحلیل استراتژیک نسخه 1.0.10 بدون تغییر در منطق Journal و منبع/حساب Dashboard.
- لایه Analytical جدید: Profit Factor، Recovery Factor، Max/Average Drawdown، Time Underwater، Ulcer Index، Payoff Ratio و Half/Quarter Kelly.
- Confidence Framework و Data Quality Score برای جلوگیری از تفسیر بیش‌ازحد نتایج نمونه‌های کوچک.
- Strategic Health Score با دلایل قابل ردیابی؛ خروجی هر نتیجه همراه Audit Rule و Evidence است.
- Monte Carlo موتور استراتژیک به حداقل 5000 مسیر یکپارچه شد؛ سناریو و Goal نیز با 5000 مسیر اجرا می‌شوند.
- روایت استراتژیک اکنون سه لایه را روشن‌تر جدا می‌کند: Analytical → Interpretive → Prescriptive.
- UI ارزیابی پیشرفته: وضعیت استراتژیک، Confidence، Profit Factor، Max DD، Expectancy CI، Half-Kelly، Recovery Factor، Ulcer Index، کیفیت داده و Audit قابل مشاهده است.
- LLM و OHLC/HMM همچنان عمداً خارج از این نسخه هستند تا هسته آماری و قابل‌ممیزی پایدار بماند.
- Unified package, PWA manifests and Service Worker version to 1.0.11 / Version Code 12.

## 1.0.10 — Strategic Analysis Engine (Advanced Evaluation)
- New «موتور تحلیل استراتژیک» panel under Dashboard → Advanced Evaluation (pure JS, rule-based, deterministic, on-device):
  - Narrative engine: status, strengths, leaks, regimes/combos to avoid, short- and mid-term actions — every finding shows its numeric evidence («چرا؟»).
  - Conditional edge by session, weekday, entry-hour block, market condition, trend alignment and pair, with t-statistic and «significant / preliminary» labels (n ≥ 8, |t| ≥ 1.96) and regime alerts.
  - Behavioural engine: Revenge Trading, Overconfidence, size escalation after a loss, Overtrade, dynamic Tilt Score (all / last 20), Discipline Score, behavioural-vs-natural-variance loss attribution, psychology-state vs performance. User-tunable rules (revenge window, win streak, size multiplier, minimum group size).
  - Strategy attribution: per-system edge, system × context interaction effects, edge-decay detection via rolling expectancy.
  - Forward-looking: scenario analysis (win-rate −10 pts, avg win −20 %, avg loss +20 %, combined), position-size table with ruin probability, goal feasibility (target % / horizon), size-capacity sensitivity.
- Advanced financial model Monte Carlo upgraded from 1000 to 5000 paths.
- Advanced Evaluation Excel/PDF export now includes the strategic-engine sheet.
- Not included (by design): LLM layer (phase 2) and OHLC-based volatility/HMM regime detection (needs bridge data).
- Unified package, PWA manifests and Service Worker version to 1.0.10 / Version Code 11.

## 1.0.9 — Journal checklist taps, Finance period chips, News rabbit animation
- Journal: checklist items 6 (آمادگی برنامه روزانه), 7 (ارزیابی چارت) and 32 (آمادگی ستاپ) in «ثبت ورود» / «ویرایش معامله» now toggle when the user taps anywhere on the condition row (including its title), not only the small tick box. Keyboard (Space/Enter) supported.
- Finance: the period chips (Daily, Weekly, Monthly, Quarterly, Yearly, All) are smaller and share the row width equally, so all of them — including Yearly — fit fully inside the screen without scrolling.
- Economic News: refresh-button animation redesigned. The rabbit's two front arms are now separate sprites that swing alternately (in opposite directions), and the rabbit's eye blinks (open/closed) while news is updating.
- Journal: the «ویرایش/انصراف» buttons of all items in «ثبت ورود» and «ثبت نتیجه معامله» are now pinned to the left edge of their title row, so every edit button sits on one vertical line.
- Unified package, PWA manifests and Service Worker version to 1.0.9 / Version Code 10.

## 1.0.8 — Layer header actions & Advanced Evaluation analytics
- News: the refresh emoji in the hint text is replaced with the Namello logo; the source box on the main News page now highlights the active news source (ForexFactory / FXStreet / Investing / custom URL) and shows «منبع فعال».
- Settings: Profile and Template each live in one independent box (header + content together); Library, Language, Profile and Template titles are right-aligned like the other sections.
- Settings → Library: removed the forward/back skip-amount option.
- Settings: the help dots button of «رنگ زمینه برنامه» now sits on the same row as its title, like the other cards.
- Dashboard: unified colour design for the section boxes (Statistical Analysis, Advanced Evaluation, Trading Psychology, Portfolio, Comprehensive Export): near-neutral body, soft gradient header, slim accent stripe and an icon chip in the section accent colour.
- Economic News: the refresh button now shows the Namello logo (rabbit & snail) running — front arms and back legs swing — while news is updating, on a green background. When the update finishes the motion stops and green stays; on failure the background turns red and the motion stops.
- Sessions, Economic News and Trading Calendar: the Settings button now sits inside the layer title box, on its left side. Economic News gets a title box matching the other layers.
- Journal: the «ثبت ورود» button now spans the full width of its card; the extra title/description text was removed.
- Dashboard → Advanced Evaluation: new quantitative panel (SQN, expectancy confidence interval, Kelly, VaR/CVaR, skewness/kurtosis, drawdown, equity R², edge drift, Runs Test, profit concentration, seeded Monte Carlo bootstrap) with an «چکیده ارزیابی» summary (score + one technical/strategic recommendation). Also included in the Advanced Evaluation Excel/PDF export.
- Unified package, PWA manifests and Service Worker version to 1.0.8 / Version Code 9.

## 1.0.7 — Journal layout redesign
- Moved the «ثبت ورود» action into a dedicated card immediately before «معاملات باز».
- Removed the adjacent Journal Excel export action from that area.
- Unified package, PWA manifest and Service Worker version to 1.0.7 / Version Code 8.

## 1.0.3
- Standard broker CSV templates and import guide
- Virtual list rendering and lazy media loading
- Improved sync conflict resolution with smart merge and status indicators
- Additional psychology metrics including Tilt-like and Revenge Risk
- Portfolio / multi-account view
- Prop Firm challenge rules and limits
- Trade Replay uses MT5 OHLC / imported TradingView-compatible OHLC
- Gradual TypeScript/Vite migration scaffold and unit tests


## 1.0.4
- Added professional Guide buttons for major layers and features.
- Added a centralized bilingual feature-help center with workflows, terminology, and practical tips.

## 1.0.6 — Advanced completion & validation
- CSV broker import: header mapping, required-field validation, numeric validation and duplicate detection.
- Replay: Play/Pause + Previous/Next/First/Last controls with progressive MFE/MAE/what-if metrics.
- TypeScript modules expanded for CSV import, Sync conflict helpers/history, psychology metrics, replay, portfolio and Prop Firm rules.
- Unit-test coverage expanded for import/sync/psychology/replay/portfolio/prop contracts while preserving the existing PWA.
- Version Code: 6.

## 1.0.13
- Regime Persistence: اندازه‌گیری ماندگاری و طول اجرای رژیم‌های OHLC/MT5.
- Change Detection: شناسایی تغییرات شدید در ویژگی‌های OHLC بین معاملات متوالی.
- Rolling Regime Edge: مقایسه Edge رژیم‌ها در پنجره جاری و پنجره قبلی برای تشخیص بهبود/افت.


## 1.0.52 — Android folder restore
- Added listing of JSON backup files in the persisted Android Storage Access Framework folder.
- Added restore flow that reads the selected backup file from that folder, validates it through the existing Namello backup parser, and then uses the existing merge/replace confirmation flow.
- The backup card now displays the user-selected folder name rather than always showing the default Download folder.
- This is source-level implementation; actual-device SAF testing is still required.

## 1.0.55 (Version Code 54)
- بازیابی پشتیبان اکنون در صورت خطای عملیات ذخیره/حذف، تلاش می‌کند داده‌های قبل از بازیابی را به‌صورت خودکار برگرداند. خطاهای بازیابی دیگر به‌صورت بی‌صدا نادیده گرفته نمی‌شوند.
