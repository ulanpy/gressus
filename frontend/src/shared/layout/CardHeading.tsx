import { eyebrow } from '../../styles/ui'

export function CardHeading({ eyebrow: eyebrowText, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-[18px]">
      <p className={eyebrow}>{eyebrowText}</p>
      <h2 className="m-0 text-2xl tracking-[-0.03em] text-text-strong">{title}</h2>
    </div>
  )
}
