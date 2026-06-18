import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../../i18n/context'
import type { PatientSessionWorkflow } from '../../hooks/usePatientSessionWorkflow'
import { cn } from '../../lib/cn'
import { IconButton, SwapIcon } from '../ui/IconButton'

type PatientSwitchProps = {
  workflow: PatientSessionWorkflow
  menuAlign?: 'left' | 'right'
  compact?: boolean
}

export function PatientSwitch({
  workflow,
  menuAlign = 'right',
  compact = false,
}: PatientSwitchProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (workflow.patientLocked) setOpen(false)
  }, [workflow.patientLocked])

  return (
    <div ref={rootRef} className={cn('relative shrink-0', compact && 'scale-90')}>
      <IconButton
        label={t.workflow.switchPatient}
        onClick={() => setOpen((value) => !value)}
        disabled={workflow.pendingAction || workflow.patients.length === 0 || workflow.patientLocked}
        className={cn(open && 'border-cyan-400')}
      >
        <SwapIcon />
      </IconButton>

      {open && (
        <ul
          className={cn(
            'absolute z-20 mt-1.5 max-h-60 min-w-[220px] overflow-auto rounded-2xl border border-panel-border bg-white p-1.5 shadow-panel',
            menuAlign === 'left' ? 'left-0' : 'right-0',
          )}
          role="listbox"
          aria-label={t.workflow.selectPatient}
        >
          {workflow.patients.map((patient) => {
            const selected = patient.id === workflow.selectedPatientId
            return (
              <li key={patient.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    'w-full rounded-xl px-3 py-2 text-left text-sm text-text-strong transition-colors',
                    selected
                      ? 'bg-slate-900 font-semibold text-white'
                      : 'hover:bg-slate-100',
                  )}
                  onClick={() => {
                    workflow.selectPatient(patient.id)
                    setOpen(false)
                  }}
                >
                  {patient.display_name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
