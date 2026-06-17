export function Field({ children, hint, label }: { children: React.ReactNode; hint?: string; label: string }) {
  return (
    <div className="grid items-start gap-1.5">
      <div className="grid gap-0.5 text-[13px] font-semibold text-text-strong">
        <span>{label}</span>
        {hint && <span className="text-xs font-medium text-muted">{hint}</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
