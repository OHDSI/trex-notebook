import type { NotebookRecord } from '../types'

interface NotebookHeaderProps {
  notebooks: NotebookRecord[]
  activeNotebook: NotebookRecord | null
  onSelect: (id: string) => void
  onCreate: () => void
  onSave: () => void
  onDelete?: () => void
  onRename?: () => void
  onImport: () => void
  onExport?: () => void
  onToggleShare?: () => void
  isShared: boolean
}

export function NotebookHeader({
  notebooks,
  activeNotebook,
  onSelect,
  onCreate,
  onSave,
  onDelete,
  onRename,
  onImport,
  onExport,
  onToggleShare,
  isShared,
}: NotebookHeaderProps) {
  return (
    <header className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2">
      <select
        className="rounded border border-input bg-background px-2 py-1 text-sm"
        value={activeNotebook?.id ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          Select notebook...
        </option>
        {notebooks.map((nb) => (
          <option key={nb.id} value={nb.id}>
            {nb.name}
          </option>
        ))}
      </select>

      <button
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
        onClick={onCreate}
      >
        New
      </button>

      <button
        className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        onClick={onSave}
        disabled={!activeNotebook}
      >
        Save
      </button>

      {onRename && (
        <button
          className="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
          onClick={onRename}
        >
          Rename
        </button>
      )}

      {onDelete && (
        <button
          className="rounded border border-destructive px-3 py-1 text-sm text-destructive hover:bg-destructive/10"
          onClick={onDelete}
        >
          Delete
        </button>
      )}

      <div className="mx-1 h-6 w-px bg-border" />

      <button
        className="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
        onClick={onImport}
      >
        Import .ipynb
      </button>

      {onExport && (
        <button
          className="rounded border border-input px-3 py-1 text-sm hover:bg-accent"
          onClick={onExport}
        >
          Export .ipynb
        </button>
      )}

      {onToggleShare && (
        <>
          <div className="mx-1 h-6 w-px bg-border" />
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={isShared}
              onChange={onToggleShare}
              className="accent-primary"
            />
            Shared
          </label>
        </>
      )}
    </header>
  )
}
