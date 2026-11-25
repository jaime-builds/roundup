# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

# Build tools for better-sqlite3 native addon (falls back to compile if no prebuilt binary)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
# No build tools, no devDependencies, no npm: the app runs with plain `node`.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get upgrade -y \
  && rm -rf /var/lib/apt/lists/* \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
            /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

WORKDIR /app

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

ENV NODE_ENV=production
ENV DB_PATH=/data/roundup.db
EXPOSE 3001

# First admin account (fresh DB only): node dist/seed.js <username> <password>
CMD ["node", "dist/server.js"]
