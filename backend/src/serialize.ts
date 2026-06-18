// Convert database rows (snake_case) into API DTOs (camelCase) for responses.

import type {
  UserRow, UserDTO,
  ProjectRow, ProjectDTO,
  ListRow, ListDTO,
  ItemRow, ItemDTO,
  TrashRow, TrashDTO,
} from './types'

export const toUserDTO = (r: UserRow): UserDTO => ({
  id: r.id,
  username: r.username,
  role: r.role,
  createdAt: r.created_at,
})

export const toProjectDTO = (r: ProjectRow, currentUserId: number): ProjectDTO => ({
  id: r.id,
  name: r.name,
  ownerId: r.owner_id,
  isOwner: r.owner_id === currentUserId,
  createdAt: r.created_at,
})

export const toListDTO = (r: ListRow): ListDTO => ({
  id: r.id,
  projectId: r.project_id,
  name: r.name,
  status: r.status,
  isDefault: !!r.is_default,
  createdAt: r.created_at,
  completedAt: r.completed_at,
})

export const toItemDTO = (r: ItemRow): ItemDTO => ({
  id: r.id,
  listId: r.list_id,
  content: r.content,
  checked: !!r.checked,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export const toTrashDTO = (r: TrashRow): TrashDTO => {
  let label = '(unknown)'
  let itemCount: number | null = null
  try {
    const data = JSON.parse(r.original_data)
    if (r.original_type === 'item') {
      label = data.content ?? '(item)'
    } else {
      label = data.list?.name ?? '(list)'
      itemCount = Array.isArray(data.items) ? data.items.length : 0
    }
  } catch {
    // leave defaults
  }
  return {
    id: r.id,
    type: r.original_type,
    label,
    itemCount,
    deletedAt: r.deleted_at,
    expiresAt: r.expires_at,
  }
}
