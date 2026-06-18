// A single item: animated checkbox + click-to-edit text + delete.

import { useEffect, useState } from 'react'
import type { Item } from '../types'
import { IconCheck, IconTrash } from '../components/icons'

interface ItemRowProps {
  item: Item
  onToggle: (checked: boolean) => void
  onEdit: (content: string) => void
  onDelete: () => void
  readOnly?: boolean
}

export function ItemRow({ item, onToggle, onEdit, onDelete, readOnly = false }: ItemRowProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(item.content)

  // Keep the local draft in sync if the item changes underneath us (e.g. via SSE).
  useEffect(() => {
    if (!editing) setText(item.content)
  }, [item.content, editing])

  const commit = () => {
    setEditing(false)
    const t = text.trim()
    if (t && t !== item.content) onEdit(t)
    else setText(item.content)
  }

  return (
    <div className={`item-row ${item.checked ? 'checked' : ''}`}>
      <button
        type="button"
        className="checkbox"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={item.checked ? 'Uncheck item' : 'Check item'}
        disabled={readOnly}
        onClick={() => onToggle(!item.checked)}
      >
        <span className="checkbox-box">
          <IconCheck size={14} />
        </span>
      </button>

      {editing ? (
        <input
          className="item-edit"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setText(item.content)
              setEditing(false)
            }
          }}
        />
      ) : (
        <span
          className="item-text"
          onClick={() => {
            if (!readOnly) setEditing(true)
          }}
        >
          {item.content}
        </span>
      )}

      {!readOnly && (
        <button type="button" className="icon-btn item-del" onClick={onDelete} aria-label="Delete item">
          <IconTrash size={18} />
        </button>
      )}
    </div>
  )
}
