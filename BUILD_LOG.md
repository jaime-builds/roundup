# Roundup — Build Log

A running log of what was completed per phase, plus assumptions made and anything deferred.

The build prompt referenced "Phases 0–7" without enumerating them, so the following
breakdown was chosen and is used consistently throughout this log:

- **Phase 0** — Scaffolding & tooling (monorepo configs, Docker, env, build setup)
- **Phase 1** — Backend foundation (SQLite schema + better-sqlite3, Fastify bootstrap)
- **Phase 2** — Auth (JWT cookies, password hashing, login/logout/me, seed script)
- **Phase 3** — Projects, members, sharing, and admin user management
- **Phase 4** — Lists, items, trash, complete/clear-checked, trash expiry
- **Phase 5** — Real-time (SSE)
- **Phase 6** — Frontend (React + Vite app: login, main view, trash, admin, styling)
- **Phase 7** — PWA (manifest, service worker, icons, iOS meta) + final verification

---

## Phase 0 — Scaffolding & tooling
Completed: 2026-06-18

**What was built**
- `docker-compose.yml` at repo root — exactly per spec (backend + frontend services,
  `infra_default` external network, `/mnt/user/appdata/roundup/data` volume).
- `.env.example` at repo root (`JWT_SECRET`, `FRONTEND_PORT`).
- `backend/` tooling: `package.json`, `tsconfig.json`, `Dockerfile`, `.dockerignore`.
- `frontend/` tooling: `package.json`, `tsconfig.json`, `tsconfig.node.json`,
  `vite.config.ts`, `index.html`, `Dockerfile`, `nginx.conf`, `.dockerignore`.
- This `BUILD_LOG.md`.

**Assumptions made**
- **API transport prefix.** The spec's route table lists logical paths
  (`/projects`, `/lists/...`, `/admin/...`, `/trash`) but the dev section says the
  frontend "proxies `/api` and `/auth`". Reconciled by serving auth routes under
  `/auth/*` and *all other* API routes under `/api/*` (so the real endpoints are
  `/api/projects`, `/api/lists/:id/items`, `/api/admin/users`, `/api/trash`, etc.).
  Both `/api` and `/auth` are proxied in dev (Vite) and prod (nginx).
- **Password hashing.** The stack table forbids extra libraries for the named layers
  but does not name a hashing library. Used Node's built-in `crypto.scryptSync`
  (salted, `timingSafeEqual` compare) to avoid adding a dependency such as bcrypt.
- **JWT library.** Used the official Fastify plugins `@fastify/jwt` + `@fastify/cookie`
  (the idiomatic Fastify way to issue/read JWTs in HTTP-only cookies).
- **Backend module system.** CommonJS output so the documented
  `npx ts-node src/seed.ts <username> <password>` works without ESM friction, and so
  better-sqlite3 (native CJS addon) loads cleanly.
- **Node base image.** `node:22-bookworm-slim` with `python3/make/g++` so
  better-sqlite3 compiles if no prebuilt binary is available.

**Deferred**
- Nothing for this phase.

---

## Phase 1 — Backend foundation (DB + Fastify)
Completed: 2026-06-18

**What was built**
- `src/config.ts` — env-driven config (port, host, JWT secret, DB path, cookie name,
  JWT/trash TTLs). Throws if `JWT_SECRET` is missing in production; dev fallback otherwise.
- `src/db.ts` — opens SQLite via better-sqlite3 (creating the parent dir), enables WAL
  + foreign keys, and applies the full schema idempotently (exactly the spec's tables +
  helpful indexes).
- `src/types.ts` — row shapes, API DTOs, and the JWT payload type.
- `src/serialize.ts` — row → DTO converters (snake_case → camelCase; `checked` → boolean).
- `src/server.ts` — Fastify bootstrap, `/health`, `/auth` + `/api` registration,
  auth decorators (see Phase 2).

**Assumptions made**
- API DTOs are camelCase and `items.checked` is exposed as a boolean (DB stores 0/1).
- DB path defaults to `/data/roundup.db` in prod, `./roundup.db` in dev, overridable
  via `DB_PATH`.

**Deferred** — none.

---

## Phase 2 — Auth + seed
Completed: 2026-06-18

**What was built**
- `src/auth.ts` — scrypt password hashing/verification (salted, constant-time compare).
- `@fastify/cookie` + `@fastify/jwt` wired in `server.ts`; JWT read from the
  `roundup_token` HTTP-only cookie.
- `app.authenticate` decorator (verifies JWT → `request.user`) and `app.requireAdmin`.
- `src/routes/auth.ts` — `POST /auth/login` (sets cookie), `POST /auth/logout`
  (clears cookie), `GET /auth/me`.
- `src/seed.ts` — `npx ts-node src/seed.ts <username> <password>` creates the first
  admin (or promotes/reset-passwords an existing user). Min password length enforced.

**Assumptions / decisions**
- Upgraded `@fastify/jwt` 9 → 10 to clear critical `fast-jwt` CVEs (auth-bypass /
  algorithm-confusion). `npm audit` is now clean (0 vulnerabilities).
- Cookie is `httpOnly`, `sameSite=lax`, `path=/`, `secure` only in production (so dev
  over http works), 30-day max-age matching the JWT expiry.
- Login returns the same 401 for "no such user" and "wrong password" (no user enumeration).

**Deferred** — none.

---

## Phase 3 — Projects, members, admin
Completed: 2026-06-18

**What was built**
- `src/repo.ts` data-access layer (all SQL).
- `src/routes/projects.ts` — list/create/rename/delete projects, share by username,
  and nested list routes. Creating a project auto-creates a default list with the
  same name (single transaction).
- `src/routes/admin.ts` — `GET/POST/DELETE /api/admin/users` (admin-role-gated scope).

**Assumptions / decisions**
- **Permission model:** project rename / delete / share are **owner-only** (403 otherwise).
  Any user with access (owner or shared member) may manage the project's lists and items.
- Admin user creation makes `member` accounts; `DELETE` refuses to delete yourself or
  the last remaining admin.
- Sharing with a non-existent username → 404; sharing with the owner → 400.
- Access checks return 404 (not 403) for projects/lists a user can't see, to avoid
  leaking existence.

**Deferred** — none.

---

## Phase 4 — Lists, items, trash
Completed: 2026-06-18

**What was built**
- `src/routes/lists.ts` — items CRUD (`GET/POST/PATCH/DELETE`), `clear-checked`.
- `src/routes/trash.ts` — `GET /api/trash`, restore, permanent delete.
- Repo trash logic: delete item / delete list / clear-checked all snapshot to the
  **list owner's** (= project owner's) trash; lists serialize their items into
  `original_data`. `expires_at = deleted_at + 30 days`; expired rows pruned on read.
  Restore re-inserts into the original parent (or 409 if the parent is gone).

**Assumptions / decisions**
- Items are returned unchecked-first, then checked (DB-side ordering); the frontend
  also fades + sinks checked items.
- "List owner" is interpreted as the owner of the project the list belongs to (lists
  have no owner column).
- Restoring creates fresh rows (new ids) preserving content/checked/created_by.

**Deferred** — none.

---

## Phase 5 — Real-time (SSE)
Completed: 2026-06-18

**What was built**
- `src/sse.ts` — per-list client registry + `sseBroadcast`.
- `GET /api/lists/:id/stream` — authenticated, access-checked SSE endpoint with a
  `connected` event, 25s heartbeat, and cleanup on disconnect.
- Item create/update/delete and clear-checked broadcast `item.created` /
  `item.updated` / `item.deleted` / `items.cleared` to that list's subscribers.

**Verification (all phases 1–5)**
Ran a full runtime smoke test against the live server (temp DB):
- health, unauth 401, bad-login 401, login + cookie, `/auth/me`.
- project create → default list auto-created; items add/check/edit; correct
  unchecked-first ordering; delete→trash; clear-checked→trash; restore.
- multi-list, complete list, delete list→trash (with `itemCount`).
- admin create user + list users; share project with member.
- **Cross-user trash:** member "bob" deleting an item put it in **admin's** trash;
  bob's own trash stayed empty. Bob blocked from admin (403) and owner-only project
  actions (403).
- **SSE:** opened the stream, posted an item, confirmed the `item.created` event arrived.
- `tsc --noEmit` clean; `npm audit` clean.

**Assumptions / decisions**
- SSE only carries item-level events (per spec: no project/list-level broadcast in v1).
- `X-Accel-Buffering: no` + nginx `proxy_buffering off` so events aren't buffered.

**Deferred** — none.

---

## Phase 6 — Frontend app
Completed: 2026-06-18

**What was built**
- Core infra: `types.ts` (mirrors backend DTOs), `api.ts` (typed client, `credentials:'include'`,
  `ApiError`), `router.tsx` (tiny history router — no dependency), `auth/AuthContext.tsx`,
  `useListStream.ts` (SSE), `useMediaQuery.ts`, `useInstallPrompt.ts`, `format.ts`.
- Components: `Modal`, `ConfirmDialog`, `PromptModal`, `icons.tsx` (inline SVGs).
- Pages: `LoginPage` (no registration link), `AppPage` (sidebar + main, responsive),
  `TrashPage`, `AdminPage`.
- Features: `Sidebar` (projects, New Project, Trash/Admin/Install links, user + logout),
  `ProjectView` (flat vs multi, collapsible Archived, owner-only rename/share/delete),
  `ListView` (flat/active/archived modes, inline rename, complete, clear-checked,
  add-item, live SSE updates with idempotent optimistic merges), `ItemRow`
  (animated checkbox, click-to-edit, delete).
- `styles.css` — full dark theme (exact spec palette), 44px tap targets, animated
  checkbox (fill + spring-scale check), checked items fade to 0.4 + sink to bottom,
  responsive one-pane mobile layout (no hamburger; tap project title / back button
  returns to the sidebar), iOS safe-area insets.

**Assumptions / decisions**
- Routing is hand-rolled (history API) to avoid adding react-router — only 4 views.
- "Flat" = the project has exactly one list (any status). Adding a 2nd list (via the
  always-available "New list" affordance) switches to the multi-list hierarchy.
- Item edits are click-to-edit inline; archived lists are read-only (can still be
  deleted to trash). Members can edit list/item content; only owners see project
  rename/share/delete actions (backend enforces this regardless).
- Optimistic local updates + idempotent SSE merges (upsert-by-id) so the actor's own
  echoed event is harmless and other clients stay live.

**Deferred** — none.

---

## Phase 7 — PWA + verification
Completed: 2026-06-18

**What was built**
- `vite.config.ts` PWA: standalone manifest (name/short_name Roundup, theme & bg
  `#0f1117`, portrait, icons 192/512 + maskable), `registerType:'autoUpdate'`,
  Workbox precaches shell assets only with `navigateFallbackDenylist` for `/api`+`/auth`
  and no runtime caching of API responses.
- `index.html` iOS meta (`apple-mobile-web-app-capable`, status-bar-style),
  apple-touch-icon, theme-color, viewport with `viewport-fit=cover`.
- `useInstallPrompt` captures Android `beforeinstallprompt`; Sidebar shows "Install app".
- `scripts/gen-icons.mjs` — dependency-free PNG encoder (zlib + hand-rolled CRC32) that
  draws a white blocky "R" on `#4A90D9`; produced `public/icons/icon-192.png` & `-512.png`.
  `public/favicon.svg` matches.

**Verification**
- Backend: `tsc --noEmit` clean, `npm audit` clean (after `@fastify/jwt` 9→10 CVE fix);
  full runtime smoke test of every route incl. cross-user trash ownership and SSE (Phase 5 log).
- Frontend: `tsc --noEmit` clean; `vite build` clean (SW + manifest generated; 11 shell
  precache entries; `/api`+`/auth` denylisted).
- End-to-end through the live Vite dev proxy (`:5173` → backend `:3001`): SPA served,
  deep-link fallback works, login over `/auth`, cookie flows, `/api/projects` CRUD,
  default-list auto-create, unauth → 401.
- Multi-agent adversarial code review (5 dimensions × per-finding verification);
  confirmed findings addressed (see below).

**Assumptions / decisions**
- Placeholder icons are generated at build-time from a script (no committed binary tooling
  dependency); real icons can replace `public/icons/*` later.
- Dev proxy target pinned to `127.0.0.1` (not `localhost`) to avoid Windows IPv6 mismatch.

**Deferred** — none. (Per instructions: no Unraid deploy, no Cloudflare, no DNS.)

---

## Review findings & fixes
Completed: 2026-06-18

A multi-agent adversarial review (5 dimensions, each finding independently verified)
confirmed 4 real findings; all were fixed and re-tested. A 5th issue surfaced during
fix-testing and was also addressed.

1. **(high) Admin user-deletion threw 500 on FK constraint.** `deleteUser` was a bare
   `DELETE FROM users` while FKs (with `PRAGMA foreign_keys=ON`) reference the user from
   projects/members/items/trash, so deleting any real account failed.
   **Fix:** `deleteUser` is now a transaction (repo.ts) — permanently deletes the user's
   owned projects (cascading lists/items/members), removes their memberships and private
   trash, and detaches items they created in *others'* projects (`created_by → NULL`;
   `created_by`/`createdBy` types relaxed to nullable). Verified: delete now returns
   `ok:true`, BobProj cascaded, bob's trash gone, bob's item in the admin project kept
   with `createdBy:null`.
2. **(low) Expired trash could be restored/deleted via a stale id.** Only the list
   endpoint pruned. **Fix:** `getTrashById` now prunes and filters on `expires_at`, so
   restore/permanent-delete treat lapsed rows as 404.
3. **(low) `POST /auth/logout` wasn't auth-guarded** (spec: only `/auth/login` is public).
   **Fix:** added `onRequest: [authenticate]` to logout (frontend already clears state
   regardless of the response, so expired sessions still log out client-side).
4. **(low) Login timing side-channel enabled username enumeration** (scrypt was skipped
   for unknown usernames). **Fix:** login always verifies against a startup-computed dummy
   hash when the user is missing, keeping the path constant-time.
5. **(found while testing) Deleted/role-changed users kept access until token expiry.**
   The stateless JWT still authenticated a deleted user — contradicting the admin UI's
   "lose access immediately." **Fix:** the `authenticate` decorator now re-loads the user
   from the DB each request (rejecting deleted users, clearing their cookie, and
   refreshing role). Verified: a deleted user's existing token immediately returns 401.

Post-fix: backend & frontend `tsc --noEmit` clean; backend `tsc` build + frontend
`vite build` clean; targeted runtime tests pass for every fix above.
