// Admin panel (admin role only): list users, create users, delete users.

import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api'
import { useRouter } from '../router'
import { useAuth } from '../auth/AuthContext'
import type { User } from '../types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IconBack, IconTrash } from '../components/icons'

export function AdminPage() {
  const { navigate } = useRouter()
  const { user: me } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<User | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    api.admin
      .users()
      .then(setUsers)
      .catch(() => setUsers([]))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const createUser = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setCreating(true)
    try {
      await api.admin.createUser(username.trim(), password)
      setUsername('')
      setPassword('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create user')
    } finally {
      setCreating(false)
    }
  }

  const confirmDelete = async () => {
    if (!toDelete) return
    setDeleting(true)
    setError('')
    try {
      await api.admin.deleteUser(toDelete.id)
      setToDelete(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete user')
      setToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate('/app')} aria-label="Back">
          <IconBack />
        </button>
        <h1>Admin</h1>
      </header>

      <div className="page-body">
        {error && <div className="banner banner-error">{error}</div>}

        <section className="card-section">
          <h2>Create user</h2>
          <form onSubmit={createUser} className="admin-form">
            <input
              placeholder="Username"
              value={username}
              autoCapitalize="none"
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              placeholder="Password (min 6)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button className="btn btn-primary" disabled={creating || !username.trim() || password.length < 6}>
              {creating ? '…' : 'Create'}
            </button>
          </form>
        </section>

        <section className="card-section">
          <h2>Users</h2>
          {loading ? (
            <div className="pad-center">
              <div className="spinner" />
            </div>
          ) : (
            <div className="user-list">
              {users.map((u) => (
                <div key={u.id} className="user-list-row">
                  <div className="user-list-info">
                    <span className="user-list-name">{u.username}</span>
                    <span className={`role-badge ${u.role}`}>{u.role}</span>
                  </div>
                  {u.id !== me?.id && (
                    <button
                      className="icon-btn danger"
                      onClick={() => setToDelete(u)}
                      aria-label={`Delete ${u.username}`}
                    >
                      <IconTrash size={18} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {toDelete && (
        <ConfirmDialog
          title="Delete user?"
          message={`Delete "${toDelete.username}"? They will lose access immediately.`}
          confirmLabel="Delete"
          danger
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
