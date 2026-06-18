// Typed API client. All requests send the auth cookie (credentials: 'include').
// Auth routes live under /auth, everything else under /api.

import type { User, Project, List, Item, TrashEntry } from './types'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  })

  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {
      // non-JSON error body — keep the default message
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const json = (body: unknown): RequestInit => ({ body: JSON.stringify(body) })

export const api = {
  auth: {
    me: () => request<{ user: User | null }>('/auth/me').then((r) => r.user),
    login: (username: string, password: string) =>
      request<{ user: User }>('/auth/login', { method: 'POST', ...json({ username, password }) }).then(
        (r) => r.user,
      ),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  },

  projects: {
    list: () => request<{ projects: Project[] }>('/api/projects').then((r) => r.projects),
    create: (name: string) =>
      request<{ project: Project }>('/api/projects', { method: 'POST', ...json({ name }) }).then(
        (r) => r.project,
      ),
    rename: (id: number, name: string) =>
      request<{ project: Project }>(`/api/projects/${id}`, { method: 'PATCH', ...json({ name }) }).then(
        (r) => r.project,
      ),
    remove: (id: number) => request<{ ok: true }>(`/api/projects/${id}`, { method: 'DELETE' }),
    share: (id: number, username: string) =>
      request<{ ok: true; member: User }>(`/api/projects/${id}/share`, {
        method: 'POST',
        ...json({ username }),
      }),
  },

  lists: {
    forProject: (projectId: number) =>
      request<{ lists: List[] }>(`/api/projects/${projectId}/lists`).then((r) => r.lists),
    create: (projectId: number, name: string) =>
      request<{ list: List }>(`/api/projects/${projectId}/lists`, { method: 'POST', ...json({ name }) }).then(
        (r) => r.list,
      ),
    rename: (projectId: number, listId: number, name: string) =>
      request<{ list: List }>(`/api/projects/${projectId}/lists/${listId}`, {
        method: 'PATCH',
        ...json({ name }),
      }).then((r) => r.list),
    complete: (projectId: number, listId: number) =>
      request<{ list: List }>(`/api/projects/${projectId}/lists/${listId}/complete`, {
        method: 'POST',
      }).then((r) => r.list),
    remove: (projectId: number, listId: number) =>
      request<{ ok: true }>(`/api/projects/${projectId}/lists/${listId}`, { method: 'DELETE' }),
  },

  items: {
    forList: (listId: number) =>
      request<{ items: Item[] }>(`/api/lists/${listId}/items`).then((r) => r.items),
    create: (listId: number, content: string) =>
      request<{ item: Item }>(`/api/lists/${listId}/items`, { method: 'POST', ...json({ content }) }).then(
        (r) => r.item,
      ),
    update: (listId: number, itemId: number, fields: { content?: string; checked?: boolean }) =>
      request<{ item: Item }>(`/api/lists/${listId}/items/${itemId}`, {
        method: 'PATCH',
        ...json(fields),
      }).then((r) => r.item),
    remove: (listId: number, itemId: number) =>
      request<{ ok: true }>(`/api/lists/${listId}/items/${itemId}`, { method: 'DELETE' }),
    clearChecked: (listId: number) =>
      request<{ ok: true; removed: number[] }>(`/api/lists/${listId}/clear-checked`, { method: 'POST' }),
  },

  trash: {
    list: () => request<{ trash: TrashEntry[] }>('/api/trash').then((r) => r.trash),
    restore: (id: number) => request<{ ok: true }>(`/api/trash/${id}/restore`, { method: 'POST' }),
    remove: (id: number) => request<{ ok: true }>(`/api/trash/${id}`, { method: 'DELETE' }),
  },

  admin: {
    users: () => request<{ users: User[] }>('/api/admin/users').then((r) => r.users),
    createUser: (username: string, password: string) =>
      request<{ user: User }>('/api/admin/users', { method: 'POST', ...json({ username, password }) }).then(
        (r) => r.user,
      ),
    deleteUser: (id: number) => request<{ ok: true }>(`/api/admin/users/${id}`, { method: 'DELETE' }),
  },
}
