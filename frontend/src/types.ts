// Frontend mirror of the backend API DTOs (see backend/src/types.ts).

export type Role = 'admin' | 'member'
export type ListStatus = 'active' | 'completed'
export type TrashType = 'list' | 'item'

export interface User {
  id: number
  username: string
  role: Role
  createdAt: string
}

export interface Project {
  id: number
  name: string
  ownerId: number
  isOwner: boolean
  createdAt: string
}

export interface List {
  id: number
  projectId: number
  name: string
  status: ListStatus
  isDefault: boolean
  createdAt: string
  completedAt: string | null
}

export interface Item {
  id: number
  listId: number
  content: string
  checked: boolean
  createdBy: number | null
  createdAt: string
  updatedAt: string
}

export interface TrashEntry {
  id: number
  type: TrashType
  label: string
  itemCount: number | null
  deletedAt: string
  expiresAt: string
}
