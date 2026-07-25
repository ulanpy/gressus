import { Label } from '@/shared/ui/label'

export function Field({ children, hint, label }: { children: React.ReactNode; hint?: string; label: string }) {
  return (
    <div className="grid items-start gap-1.5">
      <div className="grid gap-0.5">
        <Label className="text-[13px] font-semibold text-text-strong">{label}</Label>
        {hint ? <span className="text-xs font-medium text-muted">{hint}</span> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
