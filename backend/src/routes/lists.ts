// Items within a list + the real-time stream, mounted at /api/lists.
//
//   GET    /api/lists/:id/items
//   POST   /api/lists/:id/items                 { content }
//   PATCH  /api/lists/:id/items/:itemId         { content?, checked? }
//   DELETE /api/lists/:id/items/:itemId         (to list owner's trash)
//   POST   /api/lists/:id/clear-checked         (checked items -> list owner's trash)
//   GET    /api/lists/:id/stream                (SSE)
//
// Any user with access to the list's project may read/modify its items. Every
// mutation is broadcast over SSE to clients watching that list.

import type { FastifyInstance } from 'fastify'
import {
  listItemsForList, getItemById, createItem, updateItem, deleteItemToTrash, clearCheckedToTrash,
} from '../repo'
import { toItemDTO } from '../serialize'
import { loadAccessibleList } from '../access'
import { asString, asId, asBool } from '../validate'
import { sseAddClient, sseRemoveClient, sseBroadcast } from '../sse'

export async function listRoutes(app: FastifyInstance) {
  app.get('/:id/items', async (req, reply) => {
    const listId = asId((req.params as { id: string }).id)
    if (!listId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })
    return { items: listItemsForList(listId).map(toItemDTO) }
  })

  app.post('/:id/items', async (req, reply) => {
    const listId = asId((req.params as { id: string }).id)
    if (!listId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })
    const content = asString((req.body as Record<string, unknown> | undefined)?.content)
    if (!content) return reply.code(400).send({ error: 'content is required' })
    const item = createItem(listId, content, req.user.id)
    const dto = toItemDTO(item)
    sseBroadcast(listId, 'item.created', dto)
    return reply.code(201).send({ item: dto })
  })

  app.patch('/:id/items/:itemId', async (req, reply) => {
    const params = req.params as { id: string; itemId: string }
    const listId = asId(params.id)
    const itemId = asId(params.itemId)
    if (!listId || !itemId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })
    const item = getItemById(itemId)
    if (!item || item.list_id !== listId) return reply.code(404).send({ error: 'item not found' })

    const body = (req.body ?? {}) as Record<string, unknown>
    const fields: { content?: string; checked?: boolean } = {}
    if (body.content !== undefined) {
      const content = asString(body.content)
      if (!content) return reply.code(400).send({ error: 'content cannot be empty' })
      fields.content = content
    }
    if (body.checked !== undefined) {
      const checked = asBool(body.checked)
      if (checked === null) return reply.code(400).send({ error: 'checked must be a boolean' })
      fields.checked = checked
    }
    if (fields.content === undefined && fields.checked === undefined) {
      return reply.code(400).send({ error: 'nothing to update' })
    }

    const dto = toItemDTO(updateItem(itemId, fields)!)
    sseBroadcast(listId, 'item.updated', dto)
    return { item: dto }
  })

  app.delete('/:id/items/:itemId', async (req, reply) => {
    const params = req.params as { id: string; itemId: string }
    const listId = asId(params.id)
    const itemId = asId(params.itemId)
    if (!listId || !itemId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })
    const item = getItemById(itemId)
    if (!item || item.list_id !== listId) return reply.code(404).send({ error: 'item not found' })

    deleteItemToTrash(item)
    sseBroadcast(listId, 'item.deleted', { id: itemId, listId })
    return { ok: true }
  })

  app.post('/:id/clear-checked', async (req, reply) => {
    const listId = asId((req.params as { id: string }).id)
    if (!listId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })
    const removed = clearCheckedToTrash(listId)
    sseBroadcast(listId, 'items.cleared', { ids: removed, listId })
    return { ok: true, removed }
  })

  // ---- SSE stream ----
  app.get('/:id/stream', async (req, reply) => {
    const listId = asId((req.params as { id: string }).id)
    if (!listId) return reply.code(400).send({ error: 'invalid id' })
    const list = loadAccessibleList(req.user.id, listId)
    if (!list) return reply.code(404).send({ error: 'list not found' })

    reply.hijack()
    const res = reply.raw
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write(`event: connected\ndata: ${JSON.stringify({ listId })}\n\n`)
    sseAddClient(listId, res)

    // Heartbeat keeps idle connections open through proxies.
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n')
      } catch {
        // ignore — close handler cleans up
      }
    }, 25000)

    req.raw.on('close', () => {
      clearInterval(heartbeat)
      sseRemoveClient(listId, res)
    })
  })
}
