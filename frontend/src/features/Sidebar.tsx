// Left sidebar: project list, New Project, nav links (Trash / Admin / Install),
// and the current user + logout.

import type { Project, User } from '../types'
import { IconInstall, IconLogout, IconPlus, IconTrash, IconUsers } from '../components/icons'

interface SidebarProps {
  projects: Project[]
  selectedId: number | null
  loading: boolean
  user: User
  canInstall: boolean
  onSelect: (id: number) => void
  onNewProject: () => void
  onNavigate: (path: string) => void
  onLogout: () => void
  onInstall: () => void
}

export function Sidebar({
  projects,
  selectedId,
  loading,
  user,
  canInstall,
  onSelect,
  onNewProject,
  onNavigate,
  onLogout,
  onInstall,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="brand-mark sm">R</span>
        <span className="brand-name">Roundup</span>
      </div>

      <nav className="project-list">
        {loading ? (
          <p className="muted pad">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="muted pad">No projects yet.</p>
        ) : (
          projects.map((p) => (
            <button
              key={p.id}
              className={`project-item ${p.id === selectedId ? 'active' : ''}`}
              onClick={() => onSelect(p.id)}
            >
              <span className="project-item-name">{p.name}</span>
              {!p.isOwner && <span className="shared-badge">shared</span>}
            </button>
          ))
        )}
      </nav>

      <div className="sidebar-foot">
        <button className="btn btn-primary btn-block" onClick={onNewProject}>
          <IconPlus size={18} /> New Project
        </button>

        <div className="sidebar-links">
          <button className="link-btn" onClick={() => onNavigate('/trash')}>
            <IconTrash size={18} /> Trash
          </button>
          {user.role === 'admin' && (
            <button className="link-btn" onClick={() => onNavigate('/admin')}>
              <IconUsers size={18} /> Admin
            </button>
          )}
          {canInstall && (
            <button className="link-btn" onClick={onInstall}>
              <IconInstall size={18} /> Install app
            </button>
          )}
        </div>

        <div className="user-row">
          <span className="user-name">{user.username}</span>
          <button className="icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
            <IconLogout size={18} />
          </button>
        </div>
      </div>
    </aside>
  )
}
