# Vault

Document attestation using a Merkle tree and a hash-chained audit log.

## What works
- Merkle tree over file chunks, with inclusion proofs
- Audit log where each entry is hashed with the previous one
- PostgreSQL schema via Prisma

## What doesn't exist yet
- API routes, authentication, file upload UI

## Setup
```
npm install
cp .env.example .env     # then edit .env with your database URL
npx prisma migrate dev
npx prisma db seed
npm test
```