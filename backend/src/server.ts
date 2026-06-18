// Fastify bootstrap: cookies + JWT, auth decorators, route registration.
//
// Routing layout (see BUILD_LOG.md for the rationale behind the /api + /auth split):
//   /auth/*  — login / logout / me
//   /api/*   — everything else; the whole scope requires a valid JWT cookie

import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify'
import cookie from '@fastify/cookie'
import jwt from '@fastify/jwt'
import { config } from './config'
import './db' // open + migrate the database on startup
import { getUserById } from './repo'
import type { JwtUser } from './types'

import { authRoutes } from './routes/auth'
import { adminRoutes } from './routes/admin'
import { projectRoutes } from './routes/projects'
import { listRoutes } from './routes/lists'
import { trashRoutes } from './routes/trash'

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireAdmin: (req: FastifyRequest, reply: FastifyReply) => Promise<void>
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtUser
    user: JwtUser
  }
}

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.isProd ? 'info' : 'debug' },
    trustProxy: true,
  })

  await app.register(cookie)
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: config.cookieName, signed: false },
  })

  // Verify the JWT (read from the cookie) and populate request.user. The user is
  // re-loaded from the DB on every request so that deletions and role changes take
  // effect immediately, rather than lingering until the stateless token expires.
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify()
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const current = getUserById(req.user.id)
    if (!current) {
      reply.clearCookie(config.cookieName, { path: '/' })
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    req.user = { id: current.id, username: current.username, role: current.role }
  })

  // Requires the authenticated user to be an admin. Runs after `authenticate`.
  app.decorate('requireAdmin', async (req: FastifyRequest, reply: FastifyReply) => {
    if (req.user?.role !== 'admin') {
      return reply.code(403).send({ error: 'Forbidden' })
    }
  })

  // Liveness probe (unauthenticated).
  app.get('/health', async () => ({ ok: true }))

  // Auth routes (login is public; /me authenticates itself).
  await app.register(authRoutes, { prefix: '/auth' })

  // Everything else lives under /api and requires authentication.
  await app.register(
    async (api) => {
      api.addHook('onRequest', api.authenticate)
      await api.register(adminRoutes, { prefix: '/admin' })
      await api.register(projectRoutes, { prefix: '/projects' })
      await api.register(listRoutes, { prefix: '/lists' })
      await api.register(trashRoutes, { prefix: '/trash' })
    },
    { prefix: '/api' },
  )

  return app
}

async function start() {
  const app = await buildServer()
  try {
    await app.listen({ port: config.port, host: config.host })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

// Only auto-start when run directly (so tests/seed can import without listening).
if (require.main === module) {
  void start()
}
