// Admin-only user management, mounted at /api/admin.
// The parent /api scope already authenticates; this scope additionally requires
// the 'admin' role on every route.
//   GET    /api/admin/users
//   POST   /api/admin/users          { username, password }
//   DELETE /api/admin/users/:id

import type { FastifyInstance } from 'fastify'
import { listUsers, getUserById, getUserByUsername, createUser, deleteUser, countAdmins } from '../repo'
import { toUserDTO } from '../serialize'
import { asString, asId } from '../validate'

export async function adminRoutes(app: FastifyInstance) {
  // Every route in this scope requires admin.
  app.addHook('preHandler', app.requireAdmin)

  app.get('/users', async () => ({ users: listUsers().map(toUserDTO) }))

  app.post('/users', async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    const username = asString(body.username)
    const password = typeof body.password === 'string' ? body.password : null
    if (!username || !password) {
      return reply.code(400).send({ error: 'username and password are required' })
    }
    if (password.length < 6) {
      return reply.code(400).send({ error: 'password must be at least 6 characters' })
    }
    if (getUserByUsername(username)) {
      return reply.code(409).send({ error: 'username already taken' })
    }
    const user = createUser(username, password, 'member')
    return reply.code(201).send({ user: toUserDTO(user) })
  })

  app.delete('/users/:id', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    if (id === req.user.id) {
      return reply.code(400).send({ error: 'you cannot delete your own account' })
    }
    const target = getUserById(id)
    if (!target) return reply.code(404).send({ error: 'user not found' })
    if (target.role === 'admin' && countAdmins() <= 1) {
      return reply.code(400).send({ error: 'cannot delete the last admin' })
    }
    deleteUser(id)
    return { ok: true }
  })
}
