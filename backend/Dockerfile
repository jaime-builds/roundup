FROM node:22-bookworm-slim

# Build tools for better-sqlite3 native addon (falls back to compile if no prebuilt binary)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
ENV DB_PATH=/data/roundup.db
EXPOSE 3001

CMD ["node", "dist/server.js"]
