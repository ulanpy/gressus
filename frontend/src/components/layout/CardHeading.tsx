
export function CardHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="card-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
    </div>
  )
}
