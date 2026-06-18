// Subscribes to a list's SSE stream and dispatches item events. Handlers are kept
// in a ref so updating them doesn't reopen the connection.

import { useEffect, useRef } from 'react'
import type { Item } from './types'

interface StreamHandlers {
  onCreated?: (item: Item) => void
  onUpdated?: (item: Item) => void
  onDeleted?: (id: number) => void
  onCleared?: (ids: number[]) => void
}

export function useListStream(listId: number | null, handlers: StreamHandlers, enabled = true) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    if (!enabled || listId == null) return

    const es = new EventSource(`/api/lists/${listId}/stream`)
    const parse = (e: Event) => JSON.parse((e as MessageEvent).data)

    es.addEventListener('item.created', (e) => ref.current.onCreated?.(parse(e)))
    es.addEventListener('item.updated', (e) => ref.current.onUpdated?.(parse(e)))
    es.addEventListener('item.deleted', (e) => ref.current.onDeleted?.(parse(e).id))
    es.addEventListener('items.cleared', (e) => ref.current.onCleared?.(parse(e).ids))

    return () => es.close()
  }, [listId, enabled])
}
