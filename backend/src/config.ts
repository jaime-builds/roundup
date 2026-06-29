// Central runtime configuration, resolved from environment variables.

const isProd = process.env.NODE_ENV === 'production'

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (secret && secret.length > 0) return secret
  if (isProd) {
    throw new Error('JWT_SECRET must be set in production')
  }
  // Dev-only fallback so the server starts without setup.
  return 'dev-only-insecure-secret-change-me'
}

function resolveDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH
  return isProd ? '/data/roundup.db' : './roundup.db'
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 3001,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: resolveJwtSecret(),
  dbPath: resolveDbPath(),
  // Name of the HTTP-only cookie that carries the JWT.
  cookieName: 'roundup_token',
  // Set to false when serving over HTTP (e.g. internal .lan). Defaults to true in prod.
  cookieSecure: process.env.COOKIE_SECURE !== 'false' && isProd,
  // How long a JWT stays valid.
  jwtMaxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
  // How long trashed records live before they expire.
  trashTtlDays: 30,
}
