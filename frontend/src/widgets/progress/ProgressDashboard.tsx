import { memo } from 'react'
import type { CemrrProgressState } from '../../hooks/useCemrrProgress'
import { useI18n } from '../../i18n/context'
import { cn } from '@/shared/lib/utils'
import { cemrrGrid, cemrrGridTwo, container } from '../../styles/ui'
import { CemrrUpload } from './cemrr/CemrrUpload'
import { GriHero } from './cemrr/GriHero'
import { AspectScoresCard } from './cemrr/AspectScoresCard'
import { TimingStrideCards } from './cemrr/TimingStrideCards'
import { TorqueCard } from './cemrr/TorqueCard'
import { AliCard } from './cemrr/AliCard'
import { JsiCard } from './cemrr/JsiCard'
import { CemrrRecommendationsCard } from './cemrr/CemrrRecommendationsCard'
import { SessionsHistoryCard } from './cemrr/SessionsHistoryCard'

type ProgressDashboardProps = {
  cemrr: CemrrProgressState
}

function ProgressDashboardInner({ cemrr }: ProgressDashboardProps) {
  const { t } = useI18n()
  const { results, activeResult, recommendations, error } = cemrr

  return (
    <section className={cn(container, 'grid gap-[18px] mt-6')} aria-label={t.progress.aria}>
      <CemrrUpload
        onText={cemrr.handleText}
        onLoadExample={cemrr.handleLoadExample}
        error={error}
        sessionCount={results.length}
        onClear={cemrr.handleClear}
      />

      {activeResult && (
        <>
          {results.length > 1 && (
            <SessionsHistoryCard
              results={results}
              activeSession={activeResult.session}
              onSelect={cemrr.setActiveSession}
            />
          )}

          <GriHero result={activeResult} />
          <AspectScoresCard result={activeResult} />
          <TimingStrideCards result={activeResult} />

          <div className={cn(cemrrGrid, cemrrGridTwo)}>
            <AliCard result={activeResult} />
            <JsiCard result={activeResult} />
          </div>

          <TorqueCard result={activeResult} />
          <CemrrRecommendationsCard recommendations={recommendations} />
        </>
      )}
    </section>
  )
}

export const ProgressDashboard = memo(ProgressDashboardInner)
