// Login screen. No registration link (accounts are admin-created only).

import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useRouter } from '../router'
import { ApiError } from '../api'

export function LoginPage() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(username.trim(), password)
      navigate('/app')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in')
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <span className="brand-mark">R</span>
          <h1>Roundup</h1>
        </div>
        <label className="field">
          <span>Username</span>
          <input
            value={username}
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            autoComplete="current-password"
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy || !username || !password}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
