// Data-access layer. All SQL lives here; routes call these functions.
//
// Trash semantics (per spec): when any user deletes an item or list it goes to
// the *list owner's* trash — i.e. the owner of the project the list belongs to —
// not the deleter's. Trashed records expire 30 days after deletion; expired rows
// are pruned whenever trash is read.

import { db } from './db'
import { config } from './config'
import { hashPassword } from './auth'
import type {
  UserRow, ProjectRow, ListRow, ItemRow, TrashRow, Role,
} from './types'

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export function getUserById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function getUserByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
}

export function listUsers(): UserRow[] {
  return db.prepare('SELECT * FROM users ORDER BY id ASC').all() as UserRow[]
}

export function createUser(username: string, password: string, role: Role = 'member'): UserRow {
  const info = db
    .prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
    .run(username, hashPassword(password), role)
  return getUserById(Number(info.lastInsertRowid))!
}

// Delete a user and clean up everything that references them (foreign keys are
// enforced, so a bare DELETE would fail). Owned projects are removed permanently
// (project deletion is permanent per spec, cascading their lists/items/members);
// memberships and the user's private trash are removed; items the user created in
// projects they don't own are detached (created_by -> NULL) rather than deleted.
export const deleteUser = db.transaction((id: number): void => {
  const ownedIds = (db.prepare('SELECT id FROM projects WHERE owner_id = ?').all(id) as { id: number }[]).map(
    (r) => r.id,
  )
  for (const pid of ownedIds) {
    db.prepare('DELETE FROM items WHERE list_id IN (SELECT id FROM lists WHERE project_id = ?)').run(pid)
    db.prepare('DELETE FROM lists WHERE project_id = ?').run(pid)
    db.prepare('DELETE FROM project_members WHERE project_id = ?').run(pid)
    db.prepare('DELETE FROM projects WHERE id = ?').run(pid)
  }
  db.prepare('DELETE FROM project_members WHERE user_id = ?').run(id)
  db.prepare('DELETE FROM trash WHERE owner_id = ?').run(id)
  db.prepare('UPDATE items SET created_by = NULL WHERE created_by = ?').run(id)
  db.prepare('DELETE FROM users WHERE id = ?').run(id)
})

export function countAdmins(): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get() as { n: number }
  return row.n
}

// ---------------------------------------------------------------------------
// Projects + membership
// ---------------------------------------------------------------------------

export function getProjectById(id: number): ProjectRow | undefined {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
}

export function listProjectsForUser(userId: number): ProjectRow[] {
  return db
    .prepare(
      `SELECT DISTINCT p.*
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = @uid
        WHERE p.owner_id = @uid OR pm.user_id IS NOT NULL
        ORDER BY p.created_at ASC, p.id ASC`,
    )
    .all({ uid: userId }) as ProjectRow[]
}

export function userCanAccessProject(userId: number, projectId: number): boolean {
  const row = db
    .prepare(
      `SELECT 1
         FROM projects p
         LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = @uid
        WHERE p.id = @pid AND (p.owner_id = @uid OR pm.user_id IS NOT NULL)
        LIMIT 1`,
    )
    .get({ uid: userId, pid: projectId })
  return !!row
}

export function isProjectOwner(userId: number, projectId: number): boolean {
  const row = db.prepare('SELECT 1 FROM projects WHERE id = ? AND owner_id = ?').get(projectId, userId)
  return !!row
}

// Create a project and auto-create a default list with the same name.
export const createProject = db.transaction((name: string, ownerId: number): ProjectRow => {
  const info = db.prepare('INSERT INTO projects (name, owner_id) VALUES (?, ?)').run(name, ownerId)
  const projectId = Number(info.lastInsertRowid)
  db.prepare("INSERT INTO lists (project_id, name, status) VALUES (?, ?, 'active')").run(projectId, name)
  return getProjectById(projectId)!
})

export function renameProject(projectId: number, name: string): ProjectRow | undefined {
  db.prepare('UPDATE projects SET name = ? WHERE id = ?').run(name, projectId)
  return getProjectById(projectId)
}

export function addProjectMember(projectId: number, userId: number): void {
  db.prepare('INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)').run(projectId, userId)
}

// Permanent delete (no trash) of a project and everything under it.
export const deleteProjectPermanent = db.transaction((projectId: number): void => {
  db.prepare('DELETE FROM items WHERE list_id IN (SELECT id FROM lists WHERE project_id = ?)').run(projectId)
  db.prepare('DELETE FROM lists WHERE project_id = ?').run(projectId)
  db.prepare('DELETE FROM project_members WHERE project_id = ?').run(projectId)
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
})

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export function getListById(id: number): ListRow | undefined {
  return db.prepare('SELECT * FROM lists WHERE id = ?').get(id) as ListRow | undefined
}

export function listListsForProject(projectId: number): ListRow[] {
  return db
    .prepare('SELECT * FROM lists WHERE project_id = ? ORDER BY created_at ASC, id ASC')
    .all(projectId) as ListRow[]
}

export function countListsForProject(projectId: number): number {
  const row = db.prepare('SELECT COUNT(*) AS n FROM lists WHERE project_id = ?').get(projectId) as { n: number }
  return row.n
}

export function createList(projectId: number, name: string): ListRow {
  const info = db
    .prepare("INSERT INTO lists (project_id, name, status) VALUES (?, ?, 'active')")
    .run(projectId, name)
  return getListById(Number(info.lastInsertRowid))!
}

export function renameList(listId: number, name: string): ListRow | undefined {
  db.prepare('UPDATE lists SET name = ? WHERE id = ?').run(name, listId)
  return getListById(listId)
}

export function completeList(listId: number): ListRow | undefined {
  db.prepare("UPDATE lists SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(listId)
  return getListById(listId)
}

// Resolve the trash owner for a list = owner of the list's project.
export function trashOwnerForList(listId: number): number | undefined {
  const row = db
    .prepare('SELECT p.owner_id AS ownerId FROM lists l JOIN projects p ON p.id = l.project_id WHERE l.id = ?')
    .get(listId) as { ownerId: number } | undefined
  return row?.ownerId
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export function getItemById(id: number): ItemRow | undefined {
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as ItemRow | undefined
}

export function listItemsForList(listId: number): ItemRow[] {
  // Unchecked first, then checked; stable by creation order within each group.
  return db
    .prepare('SELECT * FROM items WHERE list_id = ? ORDER BY checked ASC, created_at ASC, id ASC')
    .all(listId) as ItemRow[]
}

export function createItem(listId: number, content: string, userId: number): ItemRow {
  const info = db
    .prepare('INSERT INTO items (list_id, content, created_by) VALUES (?, ?, ?)')
    .run(listId, content, userId)
  return getItemById(Number(info.lastInsertRowid))!
}

export function updateItem(
  itemId: number,
  fields: { content?: string; checked?: boolean },
): ItemRow | undefined {
  const sets: string[] = []
  const params: Record<string, unknown> = { id: itemId }
  if (fields.content !== undefined) {
    sets.push('content = @content')
    params.content = fields.content
  }
  if (fields.checked !== undefined) {
    sets.push('checked = @checked')
    params.checked = fields.checked ? 1 : 0
  }
  sets.push('updated_at = CURRENT_TIMESTAMP')
  db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = @id`).run(params)
  return getItemById(itemId)
}

// ---------------------------------------------------------------------------
// Trash
// ---------------------------------------------------------------------------

const insertTrash = db.prepare(
  `INSERT INTO trash (original_type, original_id, original_data, owner_id, expires_at)
   VALUES (@type, @originalId, @data, @ownerId, datetime('now', '+${config.trashTtlDays} days'))`,
)

// Delete an item, sending a snapshot to the list owner's trash.
export const deleteItemToTrash = db.transaction((item: ItemRow): void => {
  const ownerId = trashOwnerForList(item.list_id)
  insertTrash.run({
    type: 'item',
    originalId: item.id,
    data: JSON.stringify(item),
    ownerId: ownerId ?? item.created_by,
  })
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id)
})

// Delete a list (and all its items) to the list owner's trash, items serialized in the snapshot.
export const deleteListToTrash = db.transaction((list: ListRow): void => {
  const items = listItemsForListRaw(list.id)
  const ownerId = getProjectById(list.project_id)?.owner_id
  insertTrash.run({
    type: 'list',
    originalId: list.id,
    data: JSON.stringify({ list, items }),
    ownerId: ownerId ?? null,
  })
  db.prepare('DELETE FROM items WHERE list_id = ?').run(list.id)
  db.prepare('DELETE FROM lists WHERE id = ?').run(list.id)
})

// Raw (creation-order) item fetch used for snapshots.
function listItemsForListRaw(listId: number): ItemRow[] {
  return db.prepare('SELECT * FROM items WHERE list_id = ? ORDER BY id ASC').all(listId) as ItemRow[]
}

// Clear checked items from a list; each goes to the list owner's trash.
// Returns the ids of the items that were removed (for SSE broadcast).
export const clearCheckedToTrash = db.transaction((listId: number): number[] => {
  const checked = db
    .prepare('SELECT * FROM items WHERE list_id = ? AND checked = 1 ORDER BY id ASC')
    .all(listId) as ItemRow[]
  const ownerId = trashOwnerForList(listId)
  const removed: number[] = []
  for (const item of checked) {
    insertTrash.run({
      type: 'item',
      originalId: item.id,
      data: JSON.stringify(item),
      ownerId: ownerId ?? item.created_by,
    })
    db.prepare('DELETE FROM items WHERE id = ?').run(item.id)
    removed.push(item.id)
  }
  return removed
})

export function pruneExpiredTrash(): void {
  db.prepare("DELETE FROM trash WHERE expires_at <= datetime('now')").run()
}

export function listTrashForUser(userId: number): TrashRow[] {
  pruneExpiredTrash()
  return db
    .prepare('SELECT * FROM trash WHERE owner_id = ? ORDER BY deleted_at DESC, id DESC')
    .all(userId) as TrashRow[]
}

export function getTrashById(id: number): TrashRow | undefined {
  // Expiry is enforced on access: prune lapsed rows and never return an expired one,
  // so restore/permanent-delete can't act on a row past its 30-day TTL.
  pruneExpiredTrash()
  return db.prepare("SELECT * FROM trash WHERE id = ? AND expires_at > datetime('now')").get(id) as
    | TrashRow
    | undefined
}

export function deleteTrashRow(id: number): void {
  db.prepare('DELETE FROM trash WHERE id = ?').run(id)
}

// Restore a trashed item or list. Returns ok:false (without consuming the trash
// row) if the parent the record needs to be restored into is gone.
export function restoreFromTrash(t: TrashRow): { ok: boolean; message?: string } {
  if (t.original_type === 'item') {
    const item = JSON.parse(t.original_data) as ItemRow
    const listExists = db.prepare('SELECT 1 FROM lists WHERE id = ?').get(item.list_id)
    if (!listExists) return { ok: false, message: 'The list this item belonged to no longer exists.' }
    db.transaction(() => {
      db.prepare('INSERT INTO items (list_id, content, checked, created_by) VALUES (?, ?, ?, ?)')
        .run(item.list_id, item.content, item.checked, item.created_by)
      deleteTrashRow(t.id)
    })()
    return { ok: true }
  }

  const data = JSON.parse(t.original_data) as { list: ListRow; items: ItemRow[] }
  const projectExists = db.prepare('SELECT 1 FROM projects WHERE id = ?').get(data.list.project_id)
  if (!projectExists) return { ok: false, message: 'The project this list belonged to no longer exists.' }
  db.transaction(() => {
    const info = db
      .prepare('INSERT INTO lists (project_id, name, status, completed_at) VALUES (?, ?, ?, ?)')
      .run(data.list.project_id, data.list.name, data.list.status, data.list.completed_at)
    const newListId = Number(info.lastInsertRowid)
    const insItem = db.prepare('INSERT INTO items (list_id, content, checked, created_by) VALUES (?, ?, ?, ?)')
    for (const it of data.items ?? []) insItem.run(newListId, it.content, it.checked, it.created_by)
    deleteTrashRow(t.id)
  })()
  return { ok: true }
}
