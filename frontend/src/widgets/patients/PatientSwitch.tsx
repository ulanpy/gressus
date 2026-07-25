import { useI18n } from '@/i18n/context'
import type { PatientSessionWorkflow } from '@/hooks/usePatientSessionWorkflow'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/dropdown-menu'
import { SwapIcon } from '@/shared/ui/IconButton'

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
  const disabled =
    workflow.pendingAction || workflow.patients.length === 0 || workflow.patientLocked

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className={cn(
            'h-9 w-9 rounded-xl border border-border bg-white text-slate-800 shadow-panel hover:bg-slate-50',
            compact && 'h-9 w-9',
          )}
          aria-label={t.workflow.switchPatient}
          disabled={disabled}
        >
          <SwapIcon className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={menuAlign === 'left' ? 'start' : 'end'}
        className="max-h-60 min-w-[220px] rounded-xl p-1"
      >
        {workflow.patients.map((patient) => {
          const selected = patient.id === workflow.selectedPatientId
          return (
            <DropdownMenuItem
              key={patient.id}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium',
                selected && 'bg-slate-900 font-semibold text-white focus:bg-slate-900 focus:text-white',
              )}
              onClick={() => workflow.selectPatient(patient.id)}
            >
              {patient.display_name}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
