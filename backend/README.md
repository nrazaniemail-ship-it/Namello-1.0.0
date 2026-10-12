# Namello Sync Backend

## Zero-configuration local mode

The included defaults run without Google Cloud credentials:

```bash
cp .env.example .env
npm install
npm start
```

Local auth is enabled only when `NODE_ENV=development` and `NAMELLO_AUTH_MODE=local`. The PWA defaults to `http://localhost:8787` and uses `/v1/auth/dev`. This is a development convenience, not a production authentication method.

## Production

Set `NODE_ENV=production`, `NAMELLO_AUTH_MODE=google`, a real `GOOGLE_CLIENT_ID`, a strong `NAMELLO_SESSION_SECRET`, exact HTTPS `CORS_ORIGINS`, and a real API domain. Never expose local auth in production.
