import { useEffect, useRef, useState, type FC } from 'react'
import './Dialog.scss'
import './CreateNotebookDialog.scss'

interface CreateNotebookDialogProps {
  onConfirm: (name: string) => void
  onCancel: () => void
  existingNames: string[]
}

export const CreateNotebookDialog: FC<CreateNotebookDialogProps> = ({
  onConfirm,
  onCancel,
  existingNames,
}) => {
  const [name, setName] = useState('Untitled')
  const [error, setError] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dialogRef.current?.showModal()
    inputRef.current?.select()
  }, [])

  const handleConfirm = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (existingNames.some((n) => n.toUpperCase() === trimmed.toUpperCase())) {
      setError(true)
      return
    }
    onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    }
  }

  return (
    <dialog ref={dialogRef} className="portal-dialog" onClose={onCancel}>
      <div className="portal-dialog__title">
        <span>Create Notebook</span>
        <button className="portal-dialog__close" onClick={onCancel} aria-label="Close">
          ×
        </button>
      </div>
      <hr className="portal-dialog__divider" />
      <div className="portal-dialog__content portal-dialog__content--form">
        <div className="create-notebook-dialog__input-wrapper">
          <label className="create-notebook-dialog__label">Notebook Name</label>
          <input
            ref={inputRef}
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(false)
            }}
            onKeyDown={handleKeyDown}
            className="create-notebook-dialog__input"
            placeholder="Enter a name"
          />
          {error && (
            <div className="create-notebook-dialog__error">
              A notebook with this name already exists.
            </div>
          )}
        </div>
      </div>
      <hr className="portal-dialog__divider" />
      <div className="portal-dialog__actions">
        <button className="portal-dialog__btn portal-dialog__btn--outlined" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="portal-dialog__btn portal-dialog__btn--primary"
          onClick={handleConfirm}
          disabled={!name.trim()}
        >
          Create
        </button>
      </div>
    </dialog>
  )
}
