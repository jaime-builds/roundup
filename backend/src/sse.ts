// Server-Sent Events fan-out, keyed by list id.
//
// Each open list stream registers its raw Node response here; route handlers call
// sseBroadcast() after mutating items so every connected client for that list
// receives the change.

import type { ServerResponse } from 'node:http'

const channels = new Map<number, Set<ServerResponse>>()

export function sseAddClient(listId: number, res: ServerResponse): void {
  let set = channels.get(listId)
  if (!set) {
    set = new Set()
    channels.set(listId, set)
  }
  set.add(res)
}

export function sseRemoveClient(listId: number, res: ServerResponse): void {
  const set = channels.get(listId)
  if (!set) return
  set.delete(res)
  if (set.size === 0) channels.delete(listId)
}

export type SseEventType = 'item.created' | 'item.updated' | 'item.deleted' | 'items.cleared'

export function sseBroadcast(listId: number, type: SseEventType, data: unknown): void {
  const set = channels.get(listId)
  if (!set || set.size === 0) return
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of set) {
    try {
      res.write(payload)
    } catch {
      // Broken pipe — the close handler will clean it up.
    }
  }
}

export function sseClientCount(listId: number): number {
  return channels.get(listId)?.size ?? 0
}
