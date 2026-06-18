// Top-level route switch + auth guards.

import { useEffect } from 'react'
import { useAuth } from './auth/AuthContext'
import { useRouter } from './router'
import { LoginPage } from './pages/LoginPage'
import { AppPage } from './pages/AppPage'
import { TrashPage } from './pages/TrashPage'
import { AdminPage } from './pages/AdminPage'

export function App() {
  const { user, loading } = useAuth()
  const { path, navigate } = useRouter()

  useEffect(() => {
    if (loading) return
    if (!user) {
      if (path !== '/') navigate('/')
      return
    }
    if (path === '/') {
      navigate('/app')
      return
    }
    if (path.startsWith('/admin') && user.role !== 'admin') {
      navigate('/app')
    }
  }, [user, loading, path, navigate])

  if (loading) {
    return (
      <div className="fullscreen-center">
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <LoginPage />
  if (path.startsWith('/trash')) return <TrashPage />
  if (path.startsWith('/admin')) return user.role === 'admin' ? <AdminPage /> : <AppPage />
  return <AppPage />
}
