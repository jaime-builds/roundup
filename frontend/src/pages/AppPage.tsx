// Main authenticated view: sidebar (projects) + the selected project.
// Responsive: on mobile the sidebar and the project view are shown one at a time.
// The selected project is reflected in the URL as /app/projects/:id so that
// refreshing the page restores the same project.

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useRouter } from '../router'
import { getProjectIdFromPath } from '../router'
import { useMediaQuery } from '../useMediaQuery'
import { useInstallPrompt } from '../useInstallPrompt'
import { api } from '../api'
import type { Project } from '../types'
import { Sidebar } from '../features/Sidebar'
import { ProjectView } from '../features/ProjectView'
import { PromptModal } from '../components/PromptModal'

export function AppPage() {
  const { user, logout } = useAuth()
  const { path, navigate } = useRouter()
  const isMobile = useMediaQuery('(max-width: 768px)')
  const { canInstall, promptInstall } = useInstallPrompt()

  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(() => getProjectIdFromPath(window.location.pathname))
  const [showNew, setShowNew] = useState(false)

  const loadProjects = () =>
    api.projects.list().then((rows) => {
      setProjects(rows)
      return rows
    })

  useEffect(() => {
    let active = true
    setLoading(true)
    api.projects
      .list()
      .then((rows) => active && setProjects(rows))
      .catch(() => active && setProjects([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  // On desktop, default-select the first project only if no project is in the URL.
  useEffect(() => {
    if (!isMobile && selectedId === null && projects.length > 0) {
      setSelectedId(projects[0].id)
    }
  }, [isMobile, projects, selectedId])

  // If the selected project goes away (deleted), clear the selection.
  // Only runs after loading is complete so a URL-restored id isn't cleared
  // while the project list is still being fetched.
  useEffect(() => {
    if (loading) return
    if (selectedId !== null && !projects.some((p) => p.id === selectedId)) {
      setSelectedId(null)
    }
  }, [loading, projects, selectedId])

  // Sync selectedId → URL.
  useEffect(() => {
    const urlId = getProjectIdFromPath(path)
    if (selectedId !== null) {
      if (urlId !== selectedId) {
        navigate(`/app/projects/${selectedId}`)
      }
    } else {
      if (path !== '/app') {
        navigate('/app')
      }
    }
  }, [selectedId])

  // Sync URL → selectedId (handles back/forward navigation).
  useEffect(() => {
    const urlId = getProjectIdFromPath(path)
    if (urlId !== selectedId) {
      setSelectedId(urlId)
    }
  }, [path])

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === selectedId) ?? null,
    [projects, selectedId],
  )

  const createProject = async (name: string) => {
    const project = await api.projects.create(name)
    setShowNew(false)
    await loadProjects()
    setSelectedId(project.id)
  }

  const onProjectDeleted = async () => {
    setSelectedId(null)
    await loadProjects()
  }

  return (
    <div className={`app-shell ${selectedProject ? 'show-main' : 'show-sidebar'}`}>
      <Sidebar
        projects={projects}
        selectedId={selectedId}
        loading={loading}
        user={user!}
        canInstall={canInstall}
        onSelect={setSelectedId}
        onNewProject={() => setShowNew(true)}
        onNavigate={navigate}
        onLogout={async () => {
          await logout()
          navigate('/')
        }}
        onInstall={promptInstall}
      />

      <main className="app-main">
        {selectedProject ? (
          <ProjectView
            key={selectedProject.id}
            project={selectedProject}
            isMobile={isMobile}
            onBack={() => setSelectedId(null)}
            onProjectChanged={loadProjects}
            onProjectDeleted={onProjectDeleted}
          />
        ) : (
          <div className="empty-state">
            <p>Select a project{projects.length === 0 ? ' or create one' : ''} to get started.</p>
          </div>
        )}
      </main>

      {showNew && (
        <PromptModal
          title="New project"
          label="Project name"
          placeholder="e.g. Groceries"
          submitLabel="Create"
          onSubmit={createProject}
          onCancel={() => setShowNew(false)}
        />
      )}
    </div>
  )
}
