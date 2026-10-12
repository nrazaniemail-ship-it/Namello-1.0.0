# Namello Backend Deployment

## Default local mode

No domain, VPS, or Google Client ID is required for development. Use `localhost:8787`.

## Production defaults to secure mode

Production refuses to start unless `NAMELLO_AUTH_MODE=google` and `GOOGLE_CLIENT_ID` are configured. Set an HTTPS API domain in Caddy and exact PWA origins in `CORS_ORIGINS`.

Required production values:
- `NAMELLO_AUTH_MODE=google`
- `GOOGLE_CLIENT_ID=<real Google Web Client ID>`
- `NAMELLO_SESSION_SECRET=<long random secret>`
- `CORS_ORIGINS=https://<your-pwa-domain>`
- `NAMELLO_API_DOMAIN=<your-api-domain>`

The server stores only account metadata and encrypted sync envelopes; it does not decrypt trade data.
