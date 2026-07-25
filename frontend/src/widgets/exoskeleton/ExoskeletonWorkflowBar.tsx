import { ExoskeletonIcon, ExoskeletonPrimaryAction, type ExoskeletonIconName } from '@/widgets/exoskeleton/ExoskeletonIcon'
import { Button } from '@/shared/ui/button'
import type { GaitProfile } from '@/lib/exoskeleton/profileForm'

export type ExoskeletonWorkflowState = 'initial' | 'ready' | 'running' | 'error' | 'estop'

type ExoskeletonWorkflowBarProps = {
  workflowState: ExoskeletonWorkflowState
  lastError: string | null
  busy: boolean
  showSessionContext: boolean
  patientLabel: string
  statusLabel: string
  activeProfile: GaitProfile | null
  primaryAction: {
    icon: ExoskeletonIconName
    title: string
    subtitle: string
    onClick: () => void
    variant: 'danger' | 'primary'
  }
  onEditProfile: () => void
}

export function ExoskeletonWorkflowBar({
  workflowState,
  lastError,
  busy,
  showSessionContext,
  patientLabel,
  statusLabel,
  activeProfile,
  primaryAction,
  onEditProfile,
}: ExoskeletonWorkflowBarProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-6 py-5 shadow-[0_18px_50px_rgb(15_23_42/0.05)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.02em] text-slate-950">Session Workflow</h1>

          {workflowState === 'estop' ? (
            <div className="mt-3 flex items-start gap-2 text-red-800">
              <ExoskeletonIcon name="alert" className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="text-[15px] font-extrabold">Emergency stop is active</div>
                <p className="m-0 mt-1 text-sm font-semibold text-red-700">Reset E-STOP before continuing.</p>
              </div>
            </div>
          ) : null}

          {workflowState === 'error' ? (
            <p className="m-0 mt-2 text-sm font-semibold leading-6 text-red-700">
              {lastError ?? 'The system reported an error.'}
            </p>
          ) : null}

          {workflowState === 'initial' ? (
            <p className="m-0 mt-2 text-sm font-semibold leading-6 text-slate-500">
              Start a session to begin recording.
            </p>
          ) : null}

          {showSessionContext ? (
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="m-0 text-[15px] font-extrabold text-slate-950">
                {patientLabel}
                <span className="font-semibold text-slate-400"> · </span>
                <span className="font-semibold text-slate-600">{statusLabel}</span>
              </p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  {activeProfile?.name ?? 'No profile loaded'}
                </span>
                {activeProfile ? (
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-sm font-bold text-slate-500 underline-offset-2 hover:text-slate-900"
                    disabled={busy}
                    onClick={onEditProfile}
                  >
                    Edit
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <ExoskeletonPrimaryAction
          icon={primaryAction.icon}
          title={busy ? 'Working...' : primaryAction.title}
          subtitle={primaryAction.subtitle}
          disabled={busy}
          variant={primaryAction.variant}
          onClick={primaryAction.onClick}
        />
      </div>
    </section>
  )
}
