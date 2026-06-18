// One project's main view. Decides flat (single list → items shown directly) vs
// multi-list (sections + a collapsible Archived group), and owns project-level
// actions (rename / share / delete) which are owner-only.

import { useEffect, useState } from 'react'
import type { List, Project } from '../types'
import { api, ApiError } from '../api'
import { ListView } from './ListView'
import { PromptModal } from '../components/PromptModal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { IconBack, IconChevron, IconEdit, IconPlus, IconShare, IconTrash } from '../components/icons'

interface ProjectViewProps {
  project: Project
  isMobile: boolean
  onBack: () => void
  onProjectChanged: () => void
  onProjectDeleted: () => void
}

type ActiveModal = null | 'rename' | 'share' | 'newlist' | 'delete'

export function ProjectView({ project, isMobile, onBack, onProjectChanged, onProjectDeleted }: ProjectViewProps) {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ActiveModal>(null)
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [shareResult, setShareResult] = useState('')
  const [deleting, setDeleting] = useState(false)

  const refreshLists = () =>
    api.lists.forProject(project.id).then((rows) => {
      setLists(rows)
      return rows
    })

  useEffect(() => {
    let active = true
    setLoading(true)
    setArchivedOpen(false)
    api.lists
      .forProject(project.id)
      .then((rows) => active && setLists(rows))
      .catch(() => active && setLists([]))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [project.id])

  const activeLists = lists.filter((l) => l.status === 'active')
  const archivedLists = lists.filter((l) => l.status === 'completed')
  const isFlat = lists.length === 1

  // ---- project actions ----
  const renameProject = async (name: string) => {
    await api.projects.rename(project.id, name)
    setModal(null)
    onProjectChanged()
  }

  const shareProject = async (username: string) => {
    const res = await api.projects.share(project.id, username)
    setModal(null)
    setShareResult(`Shared with ${res.member.username}.`)
    window.setTimeout(() => setShareResult(''), 4000)
  }

  const addList = async (name: string) => {
    await api.lists.create(project.id, name)
    setModal(null)
    await refreshLists()
  }

  const deleteProject = async () => {
    setDeleting(true)
    try {
      await api.projects.remove(project.id)
      onProjectDeleted()
    } catch (err) {
      setDeleting(false)
      setShareResult(err instanceof ApiError ? err.message : 'Could not delete project')
    }
  }

  return (
    <div className="project-view">
      <header className="project-header">
        {isMobile && (
          <button className="icon-btn back-btn" onClick={onBack} aria-label="Back to projects">
            <IconBack />
          </button>
        )}
        <h1
          className={`project-title ${isMobile ? 'tappable' : ''}`}
          onClick={() => isMobile && onBack()}
        >
          {project.name}
        </h1>
        {project.isOwner && (
          <div className="project-actions">
            <button className="icon-btn" onClick={() => setModal('share')} aria-label="Share project" title="Share">
              <IconShare size={18} />
            </button>
            <button className="icon-btn" onClick={() => setModal('rename')} aria-label="Rename project" title="Rename">
              <IconEdit size={18} />
            </button>
            <button
              className="icon-btn danger"
              onClick={() => setModal('delete')}
              aria-label="Delete project"
              title="Delete project"
            >
              <IconTrash size={18} />
            </button>
          </div>
        )}
      </header>

      {shareResult && <div className="banner">{shareResult}</div>}

      <div className="project-body">
        {loading ? (
          <div className="pad-center">
            <div className="spinner" />
          </div>
        ) : isFlat ? (
          <>
            <ListView list={lists[0]} projectId={project.id} mode="flat" onListsChanged={refreshLists} />
            <button className="add-list-btn" onClick={() => setModal('newlist')}>
              <IconPlus size={18} /> New list
            </button>
          </>
        ) : (
          <>
            {activeLists.map((list) => (
              <ListView key={list.id} list={list} projectId={project.id} mode="active" onListsChanged={refreshLists} />
            ))}

            <button className="add-list-btn" onClick={() => setModal('newlist')}>
              <IconPlus size={18} /> New list
            </button>

            {archivedLists.length > 0 && (
              <section className="archived-section">
                <button className="archived-toggle" onClick={() => setArchivedOpen((v) => !v)}>
                  <IconChevron className={archivedOpen ? 'rot-180' : ''} size={18} />
                  Archived ({archivedLists.length})
                </button>
                {archivedOpen && (
                  <div className="archived-lists">
                    {archivedLists.map((list) => (
                      <ListView
                        key={list.id}
                        list={list}
                        projectId={project.id}
                        mode="archived"
                        onListsChanged={refreshLists}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {modal === 'rename' && (
        <PromptModal
          title="Rename project"
          label="Project name"
          initialValue={project.name}
          submitLabel="Rename"
          onSubmit={renameProject}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'newlist' && (
        <PromptModal
          title="New list"
          label="List name"
          placeholder="e.g. Pantry"
          submitLabel="Create"
          onSubmit={addList}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'share' && (
        <PromptModal
          title="Share project"
          label="Username to share with"
          placeholder="username"
          submitLabel="Share"
          onSubmit={shareProject}
          onCancel={() => setModal(null)}
        />
      )}
      {modal === 'delete' && (
        <ConfirmDialog
          title="Delete project?"
          message={`"${project.name}" and all of its lists and items will be permanently deleted. This cannot be undone and does not go to Trash.`}
          confirmLabel="Delete permanently"
          danger
          busy={deleting}
          onConfirm={deleteProject}
          onCancel={() => setModal(null)}
        />
      )}
    </div>
  )
}
