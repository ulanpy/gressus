import { useI18n } from '../i18n/context'
import type { ControlPageProps } from '../types/components'
import { RuntimeControls } from '../components/runtime/RuntimeControls'


export function ControlPage({
  runtime,
  runtimeActionError,
  runtimePending,
  startCalibration,
  startGame,
  stopRuntime,
}: ControlPageProps) {
  const { t } = useI18n()

  return (
    <>
      <section className="hero hero--compact">
        <div>
          <p className="eyebrow">{t.control.eyebrow}</p>
          <h1>{t.control.title}</h1>
          <p className="lede">{t.control.lede}</p>
        </div>
      </section>

      <RuntimeControls
        runtime={runtime}
        actionError={runtimeActionError}
        pending={runtimePending}
        startCalibration={startCalibration}
        startGame={startGame}
        stopRuntime={stopRuntime}
      />
    </>
  )
}
