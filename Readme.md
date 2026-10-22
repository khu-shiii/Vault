# Vault

Document attestation using a Merkle tree and a hash-chained audit log.

## Features (Phase 1)
- Upload a file: it is chunked (256 KB), hashed into a Merkle tree, and registered. Only hashes are stored.
- Every upload/view is appended to a per-document hash chain; the document page re-verifies the chain.
- Public `/verify` page: drop a file, get authentic / not authentic, plus which blocks changed.
- JWT auth (httpOnly cookies, rotating refresh tokens), roles: ADMIN, SIGNER, VIEWER.

## Setup
```
npm install
cp .env.example .env     # set DATABASE_URL and both JWT secrets (openssl rand -hex 32)
npx prisma migrate dev
SEED_PASSWORD=ChangeMe123! npx prisma db seed
npm test
npm run dev              # http://localhost:3000
```
Login: `admin@example.com` / the SEED_PASSWORD you used.

## API
| Method | Path | Auth |
|---|---|---|
| POST | /api/auth/login, /refresh, /logout | – |
| GET | /api/auth/me | any |
| GET / POST | /api/documents | any / ADMIN, SIGNER (multipart `file`, optional `title`) |
| GET | /api/documents/:id | any (appends a VIEW audit entry) |
| POST | /api/verify | public, rate-limited (multipart `file`, optional `documentId`) |

Tests write rows to the DB (the audit log is append-only), so set `TEST_DATABASE_URL` to use a separate database.
