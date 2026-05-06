import { useEffect, useRef, useState } from 'react'
import { Download, Upload, RotateCcw, X, FileText, FolderClosed, Tag, Sparkles, MonitorDown } from 'lucide-react'
import { buildAIExport, isValidBackup, useNoteStore, type PlumeBackup } from './store'
import { getInstallState, subscribeInstallState, triggerInstall } from './pwaInstall'

interface SettingsModalProps {
  onClose: () => void
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10)
}

function downloadJson(text: string, filename: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

type ImportMode = 'replace' | 'merge'

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { notes, folders, tags, replaceData, mergeData, resetAll } = useNoteStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const [importPreview, setImportPreview] = useState<{
    backup: PlumeBackup
    mode: ImportMode
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [installState, setInstallState] = useState(getInstallState)

  useEffect(() => {
    return subscribeInstallState(() => setInstallState(getInstallState()))
  }, [])

  const handleInstall = async () => {
    const result = await triggerInstall()
    if (result === 'unavailable') {
      setError('The browser did not offer an install prompt yet — try again in a moment.')
    } else {
      setError(null)
    }
  }

  // Lock body scroll for the lifetime of the modal
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleExport = () => {
    const backup: PlumeBackup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes,
      folders,
      tags,
    }
    downloadJson(JSON.stringify(backup, null, 2), `plume-backup-${dateStamp()}.json`)
  }

  const handleAIExport = () => {
    const data = buildAIExport({ notes, folders, tags })
    // Pretty-printed JSON keeps the file diff-readable; agents can stream
    // it line-by-line if they prefer (each top-level key on its own line).
    downloadJson(JSON.stringify(data, null, 2), `plume-ai-export-${dateStamp()}.json`)
  }

  const handlePickFile = () => {
    setError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const parsed: unknown = JSON.parse(text)
      if (!isValidBackup(parsed)) {
        setError('That file is not a valid Plume backup.')
      } else {
        setImportPreview({ backup: parsed, mode: 'merge' })
      }
    } catch {
      setError('Could not read the file as JSON.')
    } finally {
      // Allow re-importing the same file later
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleConfirmImport = () => {
    if (!importPreview) return
    const { backup, mode } = importPreview
    if (mode === 'replace') {
      replaceData({ notes: backup.notes, folders: backup.folders, tags: backup.tags })
    } else {
      mergeData({ notes: backup.notes, folders: backup.folders, tags: backup.tags })
    }
    onClose()
  }

  const handleReset = () => {
    resetAll()
    onClose()
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-2xl bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] shadow-2xl animate-scale-in"
      >
        <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--bg-tertiary)]">
          <h2 id="settings-title" className="text-lg font-display font-bold tracking-tight">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <section className="px-5 py-4 space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <Stat icon={<FileText className="w-3.5 h-3.5" />} label="Notes" value={notes.length} />
            <Stat icon={<FolderClosed className="w-3.5 h-3.5" />} label="Folders" value={folders.length} />
            <Stat icon={<Tag className="w-3.5 h-3.5" />} label="Tags" value={tags.length} />
          </div>

          {!importPreview && !confirmReset && (
            <>
              {installState.canInstall && !installState.alreadyInstalled && (
                <Action
                  icon={<MonitorDown className="w-4 h-4" />}
                  title="Install Plume"
                  description="Install Plume as an app on this device — works offline, opens like a native app."
                  onClick={handleInstall}
                  tone="accent"
                />
              )}
              {installState.alreadyInstalled && (
                <p className="text-xs text-[var(--text-tertiary)] px-1">
                  Plume is installed on this device.
                </p>
              )}
              <Action
                icon={<Download className="w-4 h-4" />}
                title="Export backup"
                description="Download all notes, folders, and tags as a JSON file."
                onClick={handleExport}
              />
              <Action
                icon={<Sparkles className="w-4 h-4" />}
                title="Export for AI"
                description="Optimised JSON with backlinks index, snippets, and a graph for Claude / agents."
                onClick={handleAIExport}
              />
              <Action
                icon={<Upload className="w-4 h-4" />}
                title="Import backup"
                description="Restore from a Plume JSON backup."
                onClick={handlePickFile}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={handleFileChange}
              />
              <Action
                icon={<RotateCcw className="w-4 h-4" />}
                title="Reset everything"
                description="Delete all notes, folders, and tags from this browser."
                onClick={() => setConfirmReset(true)}
                tone="danger"
              />

              {error && (
                <p className="text-xs text-red-500" role="alert">
                  {error}
                </p>
              )}
            </>
          )}

          {/* Import preview / confirm */}
          {importPreview && (
            <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-3 space-y-3">
              <div className="text-sm">
                <p className="font-medium text-[var(--text-primary)]">
                  Backup from {new Date(importPreview.backup.exportedAt).toLocaleString()}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">
                  {importPreview.backup.notes.length} notes ·{' '}
                  {importPreview.backup.folders.length} folders ·{' '}
                  {importPreview.backup.tags.length} tags
                </p>
              </div>
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium text-[var(--text-secondary)] mb-1">
                  How should this be applied?
                </legend>
                <RadioRow
                  name="import-mode"
                  value="merge"
                  checked={importPreview.mode === 'merge'}
                  onChange={() => setImportPreview({ ...importPreview, mode: 'merge' })}
                  label="Merge"
                  description="Add items not already present (matched by id). Existing items stay."
                />
                <RadioRow
                  name="import-mode"
                  value="replace"
                  checked={importPreview.mode === 'replace'}
                  onChange={() => setImportPreview({ ...importPreview, mode: 'replace' })}
                  label="Replace"
                  description="Discard current data and use the backup as the new state."
                />
              </fieldset>
              <div className="flex gap-2">
                <button
                  onClick={() => setImportPreview(null)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--bg-tertiary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="flex-1 px-3 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors active:scale-[0.98]"
                >
                  Import
                </button>
              </div>
            </div>
          )}

          {confirmReset && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-3">
              <p className="text-sm text-[var(--text-primary)]">
                This will delete <strong>all</strong> notes, folders, and tags from this browser.
                There is no undo.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 px-3 py-2 rounded-lg border border-[var(--bg-tertiary)] text-sm font-medium hover:bg-[var(--bg-secondary)] transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 px-3 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors active:scale-[0.98]"
                >
                  Yes, reset
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-display font-semibold text-[var(--text-primary)]">
        {value}
      </div>
    </div>
  )
}

function Action({
  icon,
  title,
  description,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  title: string
  description: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'accent'
}) {
  const borderHover =
    tone === 'danger'
      ? 'border-red-500/30 hover:bg-red-500/10 text-red-500'
      : tone === 'accent'
      ? 'border-[var(--accent)]/40 hover:bg-[var(--accent)]/10 text-[var(--accent)]'
      : 'border-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
  const iconBg =
    tone === 'danger'
      ? 'bg-red-500/10'
      : tone === 'accent'
      ? 'bg-[var(--accent)]/15'
      : 'bg-[var(--bg-tertiary)]'
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg border transition-all duration-150 active:scale-[0.99] text-left ${borderHover}`}
    >
      <span className={`mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-lg ${iconBg}`}>
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-[var(--text-tertiary)] mt-0.5">{description}</span>
      </span>
    </button>
  )
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  description,
}: {
  name: string
  value: string
  checked: boolean
  onChange: () => void
  label: string
  description: string
}) {
  return (
    <label className="flex items-start gap-2 cursor-pointer rounded p-1.5 hover:bg-[var(--bg-secondary)]">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 accent-[var(--accent)]"
      />
      <span className="flex-1">
        <span className="block text-sm font-medium text-[var(--text-primary)]">{label}</span>
        <span className="block text-xs text-[var(--text-tertiary)]">{description}</span>
      </span>
    </label>
  )
}
