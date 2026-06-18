// Shared types: database row shapes, API DTOs, and the JWT payload.

export type Role = 'admin' | 'member'
export type ListStatus = 'active' | 'completed'
export type TrashType = 'list' | 'item'

// ---- Database row shapes (snake_case, as stored) ----

export interface UserRow {
  id: number
  username: string
  password_hash: string
  role: Role
  created_at: string
}

export interface ProjectRow {
  id: number
  name: string
  owner_id: number
  created_at: string
}

export interface ListRow {
  id: number
  project_id: number
  name: string
  status: ListStatus
  created_at: string
  completed_at: string | null
}

export interface ItemRow {
  id: number
  list_id: number
  content: string
  checked: number // 0 | 1
  created_by: number | null // null if the creating user was later deleted
  created_at: string
  updated_at: string
}

export interface TrashRow {
  id: number
  original_type: TrashType
  original_id: number
  original_data: string // JSON snapshot
  owner_id: number
  deleted_at: string
  expires_at: string
}

// ---- JWT payload ----

export interface JwtUser {
  id: number
  username: string
  role: Role
}

// ---- API DTOs (camelCase, what the frontend consumes) ----

export interface UserDTO {
  id: number
  username: string
  role: Role
  createdAt: string
}

export interface ProjectDTO {
  id: number
  name: string
  ownerId: number
  isOwner: boolean
  createdAt: string
}

export interface ListDTO {
  id: number
  projectId: number
  name: string
  status: ListStatus
  createdAt: string
  completedAt: string | null
}

export interface ItemDTO {
  id: number
  listId: number
  content: string
  checked: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface TrashDTO {
  id: number
  type: TrashType
  label: string
  itemCount: number | null // number of items for a trashed list, else null
  deletedAt: string
  expiresAt: string
}
