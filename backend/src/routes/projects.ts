// Projects + nested lists, mounted at /api/projects.
//
//   GET    /api/projects
//   POST   /api/projects                              { name }
//   PATCH  /api/projects/:id                          { name }            (owner only)
//   DELETE /api/projects/:id                          (permanent, owner only)
//   POST   /api/projects/:id/share                    { username }        (owner only)
//   GET    /api/projects/:id/lists
//   POST   /api/projects/:id/lists                    { name }
//   PATCH  /api/projects/:id/lists/:listId            { name }
//   POST   /api/projects/:id/lists/:listId/complete
//   DELETE /api/projects/:id/lists/:listId            (to list owner's trash)
//
// Project-level mutations (rename / delete / share) are owner-only. Anyone with
// access (owner or shared member) may manage the lists inside a project.

import type { FastifyInstance } from 'fastify'
import {
  listProjectsForUser, createProject, getProjectById, renameProject,
  deleteProjectPermanent, addProjectMember, isProjectOwner, userCanAccessProject,
  getUserByUsername,
  listListsForProject, getListById, createList, renameList, completeList, deleteListToTrash,
} from '../repo'
import { toProjectDTO, toListDTO, toUserDTO } from '../serialize'
import { asString, asId } from '../validate'

export async function projectRoutes(app: FastifyInstance) {
  // ---- Projects ----

  app.get('/', async (req) => ({
    projects: listProjectsForUser(req.user.id).map((p) => toProjectDTO(p, req.user.id)),
  }))

  app.post('/', async (req, reply) => {
    const name = asString((req.body as Record<string, unknown> | undefined)?.name)
    if (!name) return reply.code(400).send({ error: 'name is required' })
    const project = createProject(name, req.user.id)
    return reply.code(201).send({ project: toProjectDTO(project, req.user.id) })
  })

  app.patch('/:id', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    if (!isProjectOwner(req.user.id, id)) {
      return reply.code(403).send({ error: 'only the owner can rename this project' })
    }
    const name = asString((req.body as Record<string, unknown> | undefined)?.name)
    if (!name) return reply.code(400).send({ error: 'name is required' })
    const project = renameProject(id, name)!
    return { project: toProjectDTO(project, req.user.id) }
  })

  app.delete('/:id', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    if (!isProjectOwner(req.user.id, id)) {
      return reply.code(403).send({ error: 'only the owner can delete this project' })
    }
    deleteProjectPermanent(id)
    return { ok: true }
  })

  app.post('/:id/share', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    const project = getProjectById(id)
    if (!project) return reply.code(404).send({ error: 'project not found' })
    if (project.owner_id !== req.user.id) {
      return reply.code(403).send({ error: 'only the owner can share this project' })
    }
    const username = asString((req.body as Record<string, unknown> | undefined)?.username)
    if (!username) return reply.code(400).send({ error: 'username is required' })
    const target = getUserByUsername(username)
    if (!target) return reply.code(404).send({ error: 'no user with that username' })
    if (target.id === project.owner_id) {
      return reply.code(400).send({ error: 'that user already owns this project' })
    }
    addProjectMember(id, target.id)
    return { ok: true, member: toUserDTO(target) }
  })

  // ---- Nested lists ----

  app.get('/:id/lists', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    if (!userCanAccessProject(req.user.id, id)) {
      return reply.code(404).send({ error: 'project not found' })
    }
    return { lists: listListsForProject(id).map(toListDTO) }
  })

  app.post('/:id/lists', async (req, reply) => {
    const id = asId((req.params as { id: string }).id)
    if (!id) return reply.code(400).send({ error: 'invalid id' })
    if (!userCanAccessProject(req.user.id, id)) {
      return reply.code(404).send({ error: 'project not found' })
    }
    const name = asString((req.body as Record<string, unknown> | undefined)?.name)
    if (!name) return reply.code(400).send({ error: 'name is required' })
    const list = createList(id, name)
    return reply.code(201).send({ list: toListDTO(list) })
  })

  app.patch('/:id/lists/:listId', async (req, reply) => {
    const params = req.params as { id: string; listId: string }
    const id = asId(params.id)
    const listId = asId(params.listId)
    if (!id || !listId) return reply.code(400).send({ error: 'invalid id' })
    if (!userCanAccessProject(req.user.id, id)) {
      return reply.code(404).send({ error: 'project not found' })
    }
    const list = getListById(listId)
    if (!list || list.project_id !== id) return reply.code(404).send({ error: 'list not found' })
    const name = asString((req.body as Record<string, unknown> | undefined)?.name)
    if (!name) return reply.code(400).send({ error: 'name is required' })
    return { list: toListDTO(renameList(listId, name)!) }
  })

  app.post('/:id/lists/:listId/complete', async (req, reply) => {
    const params = req.params as { id: string; listId: string }
    const id = asId(params.id)
    const listId = asId(params.listId)
    if (!id || !listId) return reply.code(400).send({ error: 'invalid id' })
    if (!userCanAccessProject(req.user.id, id)) {
      return reply.code(404).send({ error: 'project not found' })
    }
    const list = getListById(listId)
    if (!list || list.project_id !== id) return reply.code(404).send({ error: 'list not found' })
    return { list: toListDTO(completeList(listId)!) }
  })

  app.delete('/:id/lists/:listId', async (req, reply) => {
    const params = req.params as { id: string; listId: string }
    const id = asId(params.id)
    const listId = asId(params.listId)
    if (!id || !listId) return reply.code(400).send({ error: 'invalid id' })
    if (!userCanAccessProject(req.user.id, id)) {
      return reply.code(404).send({ error: 'project not found' })
    }
    const list = getListById(listId)
    if (!list || list.project_id !== id) return reply.code(404).send({ error: 'list not found' })
    deleteListToTrash(list) // snapshot (list + items) goes to the project owner's trash
    return { ok: true }
  })
}
