import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'
import { useI18n } from '../../../i18n/context'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  cemrrUpload,
  cemrrUploadActions,
  cemrrUploadCount,
  cemrrUploadDrop,
  cemrrUploadDropActive,
  cemrrUploadDropIcon,
  cemrrUploadDropSub,
  cemrrUploadError,
} from '../../../styles/ui'

type CemrrUploadProps = {
  onText: (text: string) => void
  onLoadExample: () => void
  error: string | null
  sessionCount: number
  onClear: () => void
}

export function CemrrUpload({
  onText,
  onLoadExample,
  error,
  sessionCount,
  onClear,
}: CemrrUploadProps) {
  const { t } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const readFile = (file: File | null | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      onText(text)
    }
    reader.readAsText(file)
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer?.files?.[0]
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      readFile(file)
    }
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    readFile(event.target.files?.[0])
    event.target.value = ''
  }

  return (
    <article className={cemrrUpload}>
      <div
        className={cn(cemrrUploadDrop, isDragging && cemrrUploadDropActive)}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          onChange={handleChange}
          style={{ display: 'none' }}
        />
        <span className={cemrrUploadDropIcon} aria-hidden>
          ⤓
        </span>
        <strong>{t.progress.cemrr.dropTitle}</strong>
        {t.progress.cemrr.dropSub ? (
          <span className={cemrrUploadDropSub}>{t.progress.cemrr.dropSub}</span>
        ) : null}
      </div>

      <div className={cemrrUploadActions}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full px-3.5 text-[13px] font-semibold hover:border-cyan-400 hover:text-cyan-700"
          onClick={onLoadExample}
        >
          {t.progress.cemrr.loadExample}
        </Button>
        {sessionCount > 0 && (
          <>
            <span className={cemrrUploadCount}>
              {t.progress.cemrr.loaded}: <strong>{sessionCount}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-3 text-xs hover:border-red-400 hover:text-red-600"
              onClick={onClear}
            >
              {t.progress.cemrr.clear}
            </Button>
          </>
        )}
      </div>

      {error && <p className={cemrrUploadError}>{error}</p>}
    </article>
  )
}
