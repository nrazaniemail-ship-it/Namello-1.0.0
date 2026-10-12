# Namello 1.22 — Backend Account & Sync

## Architecture
- Google ID token is verified **server-side**.
- `google_sub` is the stable account identifier; email is profile metadata only.
- Namello creates a short-lived HMAC session token after successful Google verification.
- Google access/refresh tokens are not required for Namello sync and are not stored.
- The client encrypts all journal data with AES-256-GCM + PBKDF2-SHA256 before upload.
- Backend stores only the encrypted envelope plus non-secret revision metadata.

## API
- `POST /v1/auth/google/verify`
- `POST /v1/auth/logout`
- `GET /v1/me`
- `GET /v1/sync/latest`
- `GET /v1/sync/revisions/:revision`
- `PUT /v1/sync/revisions/:revision` with `If-Match` optimistic concurrency
- `DELETE /v1/account`

## Conflict model
- Server revision is monotonic and immutable.
- Client sends `If-Match: currentRevision`.
- A stale writer receives HTTP 409 and no overwrite occurs.
- A client that discovers a newer server revision asks the user before replacing local data.
- Server retains all revisions for rollback/audit until the account is deleted.

## Deployment
See `backend/README.md` and `backend/.env.example`.
Use HTTPS in production and restrict `CORS_ORIGINS` to the actual PWA/Android web origin(s).
