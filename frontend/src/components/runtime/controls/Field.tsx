export function Field({ children, hint, label }: { children: React.ReactNode; hint?: string; label: string }) {
  return (
    <div className="runtime__field">
      <div className="runtime__field-label">
        <span>{label}</span>
        {hint && <span className="runtime__field-hint">{hint}</span>}
      </div>
      <div className="runtime__field-control">{children}</div>
    </div>
  )
}
