# Roundup

A self-hosted shared list PWA. Projects, sub-lists, real-time sync, installable on iPhone and Android.

## Stack

- **Backend:** Fastify + Node.js
- **Frontend:** React + Vite
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT via HTTP-only cookies
- **Real-time:** Server-Sent Events (SSE)
- **PWA:** vite-plugin-pwa

## Structure

```
roundup/
  backend/    Fastify API server
  frontend/   React + Vite PWA
```

## Development

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend
cd frontend
npm install
npm run dev
```

## Deployment

Self-hosted on NinjaUnraid via Docker Compose. External access at `roundup.jaime.build`.
