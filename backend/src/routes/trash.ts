// Trash, mounted at /api/trash. Trash is private: a user sees and acts on only
// their own trash rows (owner_id = current user). Expired rows are pruned on read.
//
//   GET    /api/trash
//   POST   /api/trash/:id/restore
//   DELETE /api/trash/:id

import type { FastifyInstance } from 'fastify'
import { listTrashForUser, getTrashById, deleteTrashRow, restoreFromTrash } from '../repo'
import { toTrashDTO } from '../serialize'
import { asId } from '../validate'

export async function trashRoutes(app: FastifyInstance) {
  app.get('/', async (req) => ({
    trash: listTrashForUser(req.user.id).map(toTrashDTO),
  }))

  app.post('/:id/restore', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    const t = getTrashById(id)
    if (!t || t.owner_id !== req.user.id) return reply.code(404).send({ error: 'not found' })
    const result = restoreFromTrash(t)
    if (!result.ok) return reply.code(409).send({ error: result.message })
    return { ok: true }
  })

  app.delete('/:id', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    const t = getTrashById(id)
    if (!t || t.owner_id !== req.user.id) return reply.code(404).send({ error: 'not found' })
    deleteTrashRow(id)
    return { ok: true }
  })
}
