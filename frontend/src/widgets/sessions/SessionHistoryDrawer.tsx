import { useEffect, useState } from 'react'
import { PanelLeft } from 'lucide-react'
import { useI18n } from '@/i18n/context'
import { Button } from '@/shared/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/ui/drawer'
import type { TherapySession } from '@/types/sessions'
import { SessionHistoryList } from './SessionHistoryList'

type SessionHistoryDrawerProps = {
  patientId: string
  sessions: TherapySession[]
  activeSessionId: string | null
  selectedSessionId: string | null
  onSelectSession: (sessionId: string) => void
  className?: string
}

export function SessionHistoryDrawer({
  patientId,
  sessions,
  activeSessionId,
  selectedSessionId,
  onSelectSession,
  className,
}: SessionHistoryDrawerProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  const historyCount = sessions.filter((s) => s.id !== activeSessionId).length

  return (
    <Drawer direction="left" open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className ?? 'h-9 gap-1.5'}
        onClick={() => setOpen(true)}
      >
        <PanelLeft className="size-4" />
        {t.workflow.sessionHistory}
        {historyCount > 0 ? (
          <span className="rounded-lg bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600">
            {historyCount}
          </span>
        ) : null}
      </Button>

      <DrawerContent className="h-full data-[vaul-drawer-direction=left]:w-[min(100%,360px)] data-[vaul-drawer-direction=left]:rounded-r-2xl data-[vaul-drawer-direction=left]:sm:max-w-[360px]">
        <DrawerHeader className="border-b border-border text-left">
          <DrawerTitle>{t.workflow.sessionHistory}</DrawerTitle>
          <DrawerDescription>
            {t.workflow.selectSessionForAnalytics}
          </DrawerDescription>
        </DrawerHeader>
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto p-3">
          <SessionHistoryList
            patientId={patientId}
            sessions={sessions}
            activeSessionId={activeSessionId}
            selectedSessionId={selectedSessionId}
            onSelectSession={(sessionId) => {
              onSelectSession(sessionId)
              setOpen(false)
            }}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

export function useSelectedSessionId(
  sessions: TherapySession[],
  activeSessionId: string | null,
  patientId: string | null,
) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  useEffect(() => {
    setSelectedSessionId(null)
  }, [patientId])

  useEffect(() => {
    if (selectedSessionId && sessions.some((s) => s.id === selectedSessionId)) {
      return
    }
    const candidates = sessions.filter(
      (s) => s.id !== activeSessionId && s.analytics_status === 'ready',
    )
    if (!candidates.length) {
      setSelectedSessionId(null)
      return
    }
    setSelectedSessionId(
      candidates.reduce((best, cur) =>
        (cur.session_number ?? 0) > (best.session_number ?? 0) ? cur : best,
      ).id,
    )
  }, [sessions, activeSessionId, selectedSessionId])

  return [selectedSessionId, setSelectedSessionId] as const
}
