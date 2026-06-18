// Minimal history-based router (no dependency). Tracks the current pathname and
// exposes navigate(). Enough for the app's views: / /app /app/projects/:id /trash /admin.

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

interface RouterValue {
  path: string
  navigate: (to: string) => void
}

const RouterContext = createContext<RouterValue>({ path: '/', navigate: () => {} })

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to: string) => {
    if (to !== window.location.pathname) {
      window.history.pushState({}, '', to)
    }
    setPath(to)
  }

  return <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
}

export const useRouter = () => useContext(RouterContext)

// Parse /app/projects/:id from the current path. Returns null if not on that route.
export function getProjectIdFromPath(path: string): number | null {
  const match = path.match(/^\/app\/projects\/(\d+)/)
  if (!match) return null
  const id = parseInt(match[1], 10)
  return isNaN(id) ? null : id
}
