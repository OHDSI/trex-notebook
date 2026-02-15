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
    <header className="flex items-center justify-between border-b border-border bg-white px-4 py-2.5">
      <div className="flex items-center gap-2">
        <select
          className="rounded border border-input bg-white px-2 py-1.5 text-sm"
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

        {onRename && (
          <button
            className="px-1 py-1 text-sm text-primary hover:text-primary/70"
            onClick={onRename}
            title="Rename"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
          </button>
        )}
      </div>

      <div className="flex items-center">
        {onToggleShare && (
          <label className="flex items-center gap-1.5 px-3 py-1 text-sm font-medium text-primary">
            <input
              type="checkbox"
              checked={isShared}
              onChange={onToggleShare}
              className="accent-primary"
            />
            Shared
          </label>
        )}

        {onExport && (
          <button
            className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/70"
            onClick={onExport}
          >
            Export
          </button>
        )}

        <button
          className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/70"
          onClick={onImport}
        >
          Import
        </button>

        <button
          className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/70"
          onClick={onCreate}
        >
          New
        </button>

        <button
          className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/70 disabled:opacity-50"
          onClick={onSave}
          disabled={!activeNotebook}
        >
          Save
        </button>

        {onDelete && (
          <button
            className="px-3 py-1 text-sm font-medium text-primary hover:text-primary/70"
            onClick={onDelete}
          >
            Delete
          </button>
        )}
      </div>
    </header>
  )
}
