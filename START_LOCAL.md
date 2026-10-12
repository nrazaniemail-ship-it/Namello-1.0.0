# Namello — شروع سریع بدون Domain/Server/Google

این نسخه برای شروع بدون سه مورد Production آماده شده است.

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm start
```

Backend روی `http://localhost:8787` اجرا می‌شود.

## PWA

فایل PWA را با یک web server ساده سرو کن؛ مثلاً:

```bash
python3 -m http.server 8080
```

سپس `http://localhost:8080` را باز کن.

Namello به‌صورت پیش‌فرض Backend را روی `http://localhost:8787` می‌بیند و می‌توانی با **ورود آزمایشی محلی** وارد شوی.

## Docker

```bash
cd backend
docker compose -f docker-compose.local.yml up -d --build
```

## Production

برای Production باید بعداً فقط این سه مورد جایگزین شوند:

- دامنه API
- سرور/Cloud
- Google Web Client ID

تا آن زمان حالت local کاملاً قابل استفاده و تست است.
