// Renders one list's items and its actions. Three modes:
//   flat     — the project's only list; no list header, items shown directly
//   active   — full header (rename inline, complete, clear-checked, delete)
//   archived — read-only, faded; can be deleted (to trash)
//
// Live updates arrive over SSE; local mutations also update state optimistically.
// All merges are idempotent so the actor's own echoed SSE event is harmless.

import { useEffect, useRef, useState } from 'react'
import type { Item, List } from '../types'
import { api } from '../api'
import { useListStream } from '../useListStream'
import { ItemRow } from './ItemRow'
import { IconArchive, IconCheck, IconPlus, IconTrash } from '../components/icons'

type Mode = 'flat' | 'active' | 'archived'

interface ListViewProps {
  list: List
  projectId: number
  mode: Mode
  onListsChanged: () => void
}

const sortItems = (arr: Item[]): Item[] =>
  [...arr].sort(
    (a, b) =>
      Number(a.checked) - Number(b.checked) ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id - b.id,
  )

const upsert = (arr: Item[], item: Item): Item[] => {
  const exists = arr.some((x) => x.id === item.id)
  return sortItems(exists ? arr.map((x) => (x.id === item.id ? item : x)) : [...arr, item])
}

export function ListView({ list, projectId, mode, onListsChanged }: ListViewProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState(list.name)
  const addRef = useRef<HTMLInputElement>(null)
  const readOnly = mode === 'archived'

  useEffect(() => {
    let active = true
    setLoading(true)
    api.items
      .forList(list.id)
      .then((rows) => active && setItems(sortItems(rows)))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [list.id])

  useListStream(
    list.id,
    {
      onCreated: (item) => setItems((prev) => upsert(prev, item)),
      onUpdated: (item) => setItems((prev) => upsert(prev, item)),
      onDeleted: (id) => setItems((prev) => prev.filter((x) => x.id !== id)),
      onCleared: (ids) => setItems((prev) => prev.filter((x) => !ids.includes(x.id))),
    },
    !readOnly,
  )

  const checkedCount = items.filter((i) => i.checked).length

  // ---- item actions ----
  const addItem = async () => {
    const content = draft.trim()
    if (!content) return
    setDraft('')
    try {
      const item = await api.items.create(list.id, content)
      setItems((prev) => upsert(prev, item))
    } catch {
      setDraft(content) // restore on failure
    }
    addRef.current?.focus()
  }

  const toggleItem = async (item: Item, checked: boolean) => {
    setItems((prev) => upsert(prev, { ...item, checked })) // optimistic
    try {
      const updated = await api.items.update(list.id, item.id, { checked })
      setItems((prev) => upsert(prev, updated))
    } catch {
      setItems((prev) => upsert(prev, item)) // revert
    }
  }

  const editItem = async (item: Item, content: string) => {
    setItems((prev) => upsert(prev, { ...item, content }))
    try {
      const updated = await api.items.update(list.id, item.id, { content })
      setItems((prev) => upsert(prev, updated))
    } catch {
      setItems((prev) => upsert(prev, item))
    }
  }

  const deleteItem = async (item: Item) => {
    setItems((prev) => prev.filter((x) => x.id !== item.id))
    try {
      await api.items.remove(list.id, item.id)
    } catch {
      setItems((prev) => upsert(prev, item))
    }
  }

  const clearChecked = async () => {
    const before = items
    setItems((prev) => prev.filter((x) => !x.checked))
    try {
      await api.items.clearChecked(list.id)
    } catch {
      setItems(before)
    }
  }

  // ---- list actions ----
  const completeList = async () => {
    await api.lists.complete(projectId, list.id)
    onListsChanged()
  }

  const deleteList = async () => {
    await api.lists.remove(projectId, list.id)
    onListsChanged()
  }

  const commitRename = async () => {
    const name = nameDraft.trim()
    setRenaming(false)
    if (!name || name === list.name) {
      setNameDraft(list.name)
      return
    }
    try {
      await api.lists.rename(projectId, list.id, name)
      onListsChanged()
    } catch {
      setNameDraft(list.name)
    }
  }

  const itemList = (
    <div className="items">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          readOnly={readOnly}
          onToggle={(checked) => toggleItem(item, checked)}
          onEdit={(content) => editItem(item, content)}
          onDelete={() => deleteItem(item)}
        />
      ))}
      {!loading && items.length === 0 && <p className="muted empty-hint">Nothing here yet.</p>}
    </div>
  )

  const addBar = (
    <form
      className="add-item"
      onSubmit={(e) => {
        e.preventDefault()
        void addItem()
      }}
    >
      <button type="submit" className="icon-btn add-plus" aria-label="Add item" tabIndex={-1}>
        <IconPlus size={20} />
      </button>
      <input
        ref={addRef}
        value={draft}
        placeholder="Add an item…"
        onChange={(e) => setDraft(e.target.value)}
      />
    </form>
  )

  // ---- flat ----
  if (mode === 'flat') {
    return (
      <div className="list-block flat">
        {checkedCount > 0 && (
          <div className="flat-toolbar">
            <button className="link-btn" onClick={clearChecked}>
              <IconCheck size={16} /> Clear checked ({checkedCount})
            </button>
          </div>
        )}
        {addBar}
        {itemList}
      </div>
    )
  }

  // ---- archived ----
  if (mode === 'archived') {
    return (
      <div className="list-block archived">
        <div className="list-header">
          <h3 className="list-name">{list.name}</h3>
          <div className="list-actions">
            <button className="icon-btn danger" onClick={deleteList} aria-label="Delete list" title="Delete list">
              <IconTrash size={18} />
            </button>
          </div>
        </div>
        {itemList}
      </div>
    )
  }

  // ---- active ----
  return (
    <div className="list-block">
      <div className="list-header">
        {renaming ? (
          <input
            className="list-name-edit"
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') {
                setNameDraft(list.name)
                setRenaming(false)
              }
            }}
          />
        ) : (
          <h3 className="list-name" onClick={() => setRenaming(true)} title="Rename list">
            {list.name}
          </h3>
        )}
        <div className="list-actions">
          {checkedCount > 0 && (
            <button className="link-btn" onClick={clearChecked} title="Remove checked items">
              Clear checked
            </button>
          )}
          <button className="icon-btn" onClick={completeList} aria-label="Complete list" title="Complete list">
            <IconArchive size={18} />
          </button>
          <button className="icon-btn danger" onClick={deleteList} aria-label="Delete list" title="Delete list">
            <IconTrash size={18} />
          </button>
        </div>
      </div>
      {addBar}
      {itemList}
    </div>
  )
}
