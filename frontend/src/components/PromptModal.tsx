// A modal with a single text input — used for new project / new list / rename / share.
// Submits on Enter; surfaces async errors inline.

import { useState, type FormEvent } from 'react'
import { Modal } from './Modal'
import { ApiError } from '../api'

interface PromptModalProps {
  title: string
  label: string
  initialValue?: string
  placeholder?: string
  submitLabel?: string
  onSubmit: (value: string) => Promise<void> | void
  onCancel: () => void
}

export function PromptModal({
  title,
  label,
  initialValue = '',
  placeholder,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const v = value.trim()
    if (!v) return
    setBusy(true)
    setError('')
    try {
      await onSubmit(v)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onCancel}>
      <form onSubmit={submit}>
        <label className="field">
          <span>{label}</span>
          <input
            autoFocus
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy || !value.trim()}>
            {busy ? '…' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
