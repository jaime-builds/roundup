// Authentication routes, mounted at /auth.
//   POST /auth/login   — verify credentials, issue JWT as an HTTP-only cookie
//   POST /auth/logout  — clear the cookie
//   GET  /auth/me      — current user (requires a valid cookie)

import type { FastifyInstance } from 'fastify'
import { config } from '../config'
import { getUserByUsername, getUserById } from '../repo'
import { verifyPassword, hashPassword } from '../auth'
import { toUserDTO } from '../serialize'
import { asString } from '../validate'

// A real scrypt hash computed once at startup. Verifying against it when the
// username doesn't exist keeps the login path constant-time, so response latency
// can't be used to enumerate valid usernames.
const DUMMY_PASSWORD_HASH = hashPassword('roundup-dummy-password')

export async function authRoutes(app: FastifyInstance) {
  app.post('/login', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const username = asString(body.username)
    const password = typeof body.password === 'string' ? body.password : null
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }

    const user = getUserByUsername(username)
    // Always run the hash check (even with no user) so timing doesn't leak whether
    // the username exists; the 401 body is identical for both cases.
    const ok = verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH)
    if (!user || !ok) {
      return reply.code(401).send({ error: 'Invalid username or password' })
    }

    const token = app.jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      { expiresIn: config.jwtMaxAgeSeconds },
    )
    reply.setCookie(config.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookieSecure,
      path: '/',
      maxAge: config.jwtMaxAgeSeconds,
    })
    return { user: toUserDTO(user) }
  })

  // Logout requires auth too (per spec, only /auth/login is public). The frontend
  // clears its user state regardless of the response, so an expired session still
  // ends up logged out client-side.
  app.post('/logout', { onRequest: [app.authenticate] }, async (_req, reply) => {
    reply.clearCookie(config.cookieName, { path: '/' })
    return { ok: true }
  })

  app.get('/me', { onRequest: [app.authenticate] }, async (req) => {
    const user = getUserById(req.user.id)
    return { user: user ? toUserDTO(user) : null }
  })
}
