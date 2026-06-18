// Global trash view: restore or permanently delete. Expired rows are filtered
// server-side, so they never appear here.

import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import { useRouter } from '../router'
import { formatDate } from '../format'
import type { TrashEntry } from '../types'
import { IconArchive, IconBack, IconRestore, IconTrash } from '../components/icons'

export function TrashPage() {
  const { navigate } = useRouter()
  const [entries, setEntries] = useState<TrashEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    api.trash
      .list()
      .then((rows) => active && setEntries(rows))
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const restore = async (id: number) => {
    setBusyId(id)
    setError('')
    try {
      await api.trash.restore(id)
      setEntries((e) => e.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not restore')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: number) => {
    setBusyId(id)
    setError('')
    try {
      await api.trash.remove(id)
      setEntries((e) => e.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate('/app')} aria-label="Back">
          <IconBack />
        </button>
        <h1>Trash</h1>
      </header>

      <div className="page-body">
        <p className="muted">Deleted items and lists are kept for 30 days, then permanently removed.</p>
        {error && <div className="banner banner-error">{error}</div>}

        {loading ? (
          <div className="pad-center">
            <div className="spinner" />
          </div>
        ) : entries.length === 0 ? (
          <p className="muted pad">Trash is empty.</p>
        ) : (
          <div className="trash-list">
            {entries.map((e) => (
              <div key={e.id} className="trash-row">
                <span className={`trash-type ${e.type}`}>
                  {e.type === 'list' ? <IconArchive size={16} /> : <IconTrash size={16} />}
                </span>
                <div className="trash-info">
                  <span className="trash-label">{e.label}</span>
                  <span className="trash-meta">
                    {e.type === 'list'
                      ? `list · ${e.itemCount} item${e.itemCount === 1 ? '' : 's'}`
                      : 'item'}{' '}
                    · expires {formatDate(e.expiresAt)}
                  </span>
                </div>
                <div className="trash-actions">
                  <button className="btn btn-sm" onClick={() => restore(e.id)} disabled={busyId === e.id}>
                    <IconRestore size={16} /> Restore
                  </button>
                  <button
                    className="icon-btn danger"
                    onClick={() => remove(e.id)}
                    disabled={busyId === e.id}
                    aria-label="Delete permanently"
                  >
                    <IconTrash size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
