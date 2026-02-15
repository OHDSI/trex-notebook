import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Notebook,
  type NotebookHandle,
  type NotebookData,
  PyodideKernel,
  WebRKernel,
  createEmptyNotebook,
  serializeIpynb,
} from '@/index'
import * as notebookApi from '../api/notebook-api'
import type { NotebookRecord } from '../types'
import { parseNotebookContent } from '../utils/starboard'
import { NotebookHeader } from './NotebookHeader'
import { EmptyState } from './EmptyState'
import { DeleteDialog } from './DeleteDialog'
import { RenameDialog } from './RenameDialog'

const pyodideKernel = new PyodideKernel()
const webRKernel = new WebRKernel()

interface NotebookManagerProps {
  datasetId: string
  userId: string
  getToken?: () => Promise<string>
}

export function NotebookManager({ datasetId }: NotebookManagerProps) {
  const [notebooks, setNotebooks] = useState<NotebookRecord[]>([])
  const [activeNotebook, setActiveNotebook] = useState<NotebookRecord | null>(null)
  const [notebookData, setNotebookData] = useState<NotebookData>(createEmptyNotebook())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<NotebookRecord | null>(null)
  const [renameTarget, setRenameTarget] = useState<NotebookRecord | null>(null)

  const notebookRef = useRef<NotebookHandle>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchNotebooks = useCallback(async () => {
    if (!datasetId) return
    try {
      setLoading(true)
      setError(null)
      const list = await notebookApi.getNotebookList(datasetId)
      setNotebooks(list)
    } catch (err) {
      setError('Failed to load notebooks.')
      console.error('Failed to fetch notebooks:', err)
    } finally {
      setLoading(false)
    }
  }, [datasetId])

  useEffect(() => {
    fetchNotebooks()
  }, [fetchNotebooks])

  useEffect(() => {
    if (!activeNotebook) {
      setNotebookData(createEmptyNotebook())
      return
    }
    try {
      if (activeNotebook.notebookContent) {
        const parsed = parseNotebookContent(activeNotebook.notebookContent)
        setNotebookData(parsed)
      } else {
        setNotebookData(createEmptyNotebook())
      }
    } catch {
      console.error('Failed to parse notebook content, starting with empty notebook')
      setNotebookData(createEmptyNotebook())
    }
  }, [activeNotebook])

  const handleSelect = useCallback(
    (id: string) => {
      const nb = notebooks.find((n) => n.id === id) ?? null
      setActiveNotebook(nb)
    },
    [notebooks]
  )

  const handleCreate = useCallback(async () => {
    if (!datasetId) return
    try {
      const empty = createEmptyNotebook()
      const content = serializeIpynb(empty)
      const created = await notebookApi.createNotebook(datasetId, 'Untitled', content)
      setNotebooks((prev) => [...prev, created])
      setActiveNotebook(created)
    } catch (err) {
      console.error('Failed to create notebook:', err)
      setError('Failed to create notebook.')
    }
  }, [datasetId])

  const handleSave = useCallback(async () => {
    if (!activeNotebook || !datasetId) return
    try {
      const content = serializeIpynb(notebookData)
      const updated = await notebookApi.saveNotebook(
        activeNotebook.id,
        activeNotebook.name,
        content,
        activeNotebook.isShared,
        datasetId
      )
      setActiveNotebook(updated)
      setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      console.error('Failed to save notebook:', err)
      setError('Failed to save notebook.')
    }
  }, [activeNotebook, notebookData, datasetId])

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || !datasetId) return
    try {
      await notebookApi.deleteNotebook(deleteTarget.id, datasetId)
      setNotebooks((prev) => prev.filter((n) => n.id !== deleteTarget.id))
      if (activeNotebook?.id === deleteTarget.id) {
        setActiveNotebook(null)
      }
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete notebook:', err)
      setError('Failed to delete notebook.')
    }
  }, [deleteTarget, activeNotebook, datasetId])

  const handleRenameConfirm = useCallback(
    async (newName: string) => {
      if (!renameTarget || !datasetId) return
      try {
        const updated = await notebookApi.saveNotebook(
          renameTarget.id,
          newName,
          renameTarget.notebookContent,
          renameTarget.isShared,
          datasetId
        )
        setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
        if (activeNotebook?.id === updated.id) {
          setActiveNotebook(updated)
        }
        setRenameTarget(null)
      } catch (err) {
        console.error('Failed to rename notebook:', err)
        setError('Failed to rename notebook.')
      }
    },
    [renameTarget, activeNotebook, datasetId]
  )

  const handleToggleShare = useCallback(async () => {
    if (!activeNotebook || !datasetId) return
    try {
      const updated = await notebookApi.saveNotebook(
        activeNotebook.id,
        activeNotebook.name,
        activeNotebook.notebookContent,
        !activeNotebook.isShared,
        datasetId
      )
      setActiveNotebook(updated)
      setNotebooks((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
    } catch (err) {
      console.error('Failed to toggle sharing:', err)
      setError('Failed to update sharing.')
    }
  }, [activeNotebook, datasetId])

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file || !datasetId) return

      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string
          parseNotebookContent(content) // validate

          const name = file.name.replace(/\.(ipynb|sb|sbnb)$/, '')
          const created = await notebookApi.createNotebook(datasetId, name, content)
          setNotebooks((prev) => [...prev, created])
          setActiveNotebook(created)
        } catch (err) {
          console.error('Failed to import notebook:', err)
          setError('Failed to import notebook. Check that it is a valid .ipynb or starboard file.')
        }
      }
      reader.readAsText(file)
      event.target.value = ''
    },
    [datasetId]
  )

  const handleExport = useCallback(() => {
    if (!activeNotebook) return
    const content = serializeIpynb(notebookData)
    const blob = new Blob([content], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeNotebook.name}.ipynb`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [activeNotebook, notebookData])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        Loading notebooks...
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1">
      {error && (
        <div className="mx-4 mt-2 rounded border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <NotebookHeader
        notebooks={notebooks}
        activeNotebook={activeNotebook}
        onSelect={handleSelect}
        onCreate={handleCreate}
        onSave={handleSave}
        onDelete={activeNotebook ? () => setDeleteTarget(activeNotebook) : undefined}
        onRename={activeNotebook ? () => setRenameTarget(activeNotebook) : undefined}
        onImport={handleImport}
        onExport={activeNotebook ? handleExport : undefined}
        onToggleShare={activeNotebook ? handleToggleShare : undefined}
        isShared={activeNotebook?.isShared ?? false}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".ipynb,.sb,.sbnb"
        className="hidden"
        onChange={handleFileChange}
      />

      <main className="flex-1 p-8">
        {!activeNotebook ? (
          <EmptyState
            hasNotebooks={notebooks.length > 0}
            onCreate={handleCreate}
            onImport={handleImport}
          />
        ) : (
          <div className="rounded-lg bg-white p-8 shadow-sm">
            <Notebook
              ref={notebookRef}
              data={notebookData}
              onChange={setNotebookData}
              kernels={[pyodideKernel, webRKernel]}
              defaultKernelConfig={{ type: 'pyodide' }}
              showToolbar={true}
              showLineNumbers={true}
            />
          </div>
        )}
      </main>

      {deleteTarget && (
        <DeleteDialog
          notebookName={deleteTarget.name}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {renameTarget && (
        <RenameDialog
          currentName={renameTarget.name}
          onConfirm={handleRenameConfirm}
          onCancel={() => setRenameTarget(null)}
        />
      )}
    </div>
  )
}
