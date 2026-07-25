import { useEffect, useState } from 'react'
import { useI18n } from '@/i18n/context'
import { getLatestAnthropometrics, getLatestExoProfile, type LatestExoProfile } from '@/lib/api/sessions'
import {
  buildProfileJson,
  DEFAULT_EXO_PARAMS,
  DEFAULT_EXO_ROM,
  DEFAULT_EXO_STRUCTURAL,
  EXO_JOINTS,
  EXO_PARAM_FIELDS,
  parseStoredProfile,
  parseStructural,
  toNumber,
  type ExoMode,
  type ExoParams,
  type ExoStructural,
  type GaitProfile,
} from '@/lib/exoskeleton/profileForm'
import type { Patient } from '@/types/patients'
import type { SessionAnthropometrics } from '@/types/sessions'
import {
  buildAnthropometricsPayload,
  DEFAULT_ANTHROPOMETRICS as SESSION_DEFAULT_ANTHROPOMETRICS,
} from '@/widgets/sessions/SessionAnthropometricsLine'
import { Button } from '@/shared/ui/button'
import { Checkbox } from '@/shared/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Label } from '@/shared/ui/label'
import { Input } from '@/shared/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'

export type ExoskeletonProfileDialogProps = {
  open: boolean
  confirmLabel?: string
  includeAnthropometrics?: boolean
  initialPatientId?: string | null
  initialProfile?: GaitProfile | null
  loading: boolean
  onClose: () => void
  onConfirm: (patient: Patient, profile: GaitProfile, anthropometrics?: SessionAnthropometrics) => void
  patients: Patient[]
  title?: string
}

export function ExoskeletonProfileDialog({
  open,
  confirmLabel = 'Подтвердить и загрузить',
  includeAnthropometrics = false,
  initialPatientId,
  initialProfile,
  loading,
  onClose,
  onConfirm,
  patients,
  title = 'Начать сессию',
}: ExoskeletonProfileDialogProps) {
  const { t } = useI18n()
  const [patientId, setPatientId] = useState(initialPatientId ?? patients[0]?.id ?? '')
  const patient = patients.find((item) => item.id === patientId) ?? patients[0]
  const [lastProfile, setLastProfile] = useState<LatestExoProfile | null>(null)
  const [lastProfileLoading, setLastProfileLoading] = useState(false)
  const [params, setParams] = useState<ExoParams>(DEFAULT_EXO_PARAMS)
  const [extras, setExtras] = useState<Record<string, unknown>>({})
  const [structural, setStructural] = useState<ExoStructural>(DEFAULT_EXO_STRUCTURAL)
  const [anthropometrics, setAnthropometrics] = useState<SessionAnthropometrics>(
    SESSION_DEFAULT_ANTHROPOMETRICS,
  )

  useEffect(() => {
    if (!open) return
    setPatientId(initialPatientId ?? patients[0]?.id ?? '')
  }, [open, initialPatientId, patients])

  useEffect(() => {
    if (!patient) {
      setLastProfile(null)
      return
    }
    let cancelled = false
    setLastProfileLoading(true)
    getLatestExoProfile(patient.id)
      .then((found) => {
        if (!cancelled) setLastProfile(found)
      })
      .catch(() => {
        if (!cancelled) setLastProfile(null)
      })
      .finally(() => {
        if (!cancelled) setLastProfileLoading(false)
      })
    getLatestAnthropometrics(patient.id)
      .then((found) => {
        if (!cancelled && found) {
          setAnthropometrics({
            leg_length_left: found.leg_length_left ?? SESSION_DEFAULT_ANTHROPOMETRICS.leg_length_left,
            leg_length_right: found.leg_length_right ?? SESSION_DEFAULT_ANTHROPOMETRICS.leg_length_right,
            bodyweight: found.bodyweight ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setAnthropometrics(SESSION_DEFAULT_ANTHROPOMETRICS)
      })
    return () => {
      cancelled = true
    }
  }, [patient?.id])

  useEffect(() => {
    const parsedInitial =
      initialProfile && patient?.id === initialPatientId
        ? parseStoredProfile(initialProfile.profileJson)
        : null
    const parsed = parsedInitial ?? (lastProfile ? parseStoredProfile(lastProfile.profileJson) : null)
    if (parsed) {
      setParams(parsed.params)
      setExtras(parsed.extras)
      setStructural(parseStructural(parsed.extras))
    } else {
      setParams(DEFAULT_EXO_PARAMS)
      setExtras({})
      setStructural(DEFAULT_EXO_STRUCTURAL)
    }
  }, [initialPatientId, initialProfile, lastProfile, patient?.id])

  const hasStoredCoeffs = Array.isArray(extras.coeffs) && extras.coeffs.length > 0
  const profileJsonPreview = buildProfileJson(patient, params, structural, extras, hasStoredCoeffs)

  const setParam = (key: keyof ExoParams) => (event: { target: { value: string } }) =>
    setParams((prev) => ({ ...prev, [key]: toNumber(event.target.value, prev[key]) }))

  const setRomBound =
    (idx: string, which: 0 | 1) => (event: { target: { value: string } }) =>
      setStructural((prev) => {
        const cur = prev.rom[idx] ?? DEFAULT_EXO_ROM[idx]
        const value = toNumber(event.target.value, cur[which])
        const next: [number, number] = which === 0 ? [value, cur[1]] : [cur[0], value]
        return { ...prev, rom: { ...prev.rom, [idx]: next } }
      })

  const setAnthro =
    (key: keyof SessionAnthropometrics) => (event: { target: { value: string } }) => {
      const raw = event.target.value
      const parsed = raw === '' ? null : Number(raw)
      setAnthropometrics((prev) => ({
        ...prev,
        [key]: parsed != null && Number.isFinite(parsed) ? parsed : null,
      }))
    }

  const handleConfirm = () => {
    if (!patient) return
    onConfirm(
      patient,
      {
        id: 'exo-profile',
        name: initialProfile
          ? 'Обновлённый профиль'
          : lastProfile
            ? `Профиль (из сессии #${lastProfile.sessionNumber ?? '—'})`
            : 'Новый профиль',
        description: '',
        baselineRequired: false,
        profileJson: profileJsonPreview,
      },
      buildAnthropometricsPayload(anthropometrics),
    )
  }

  const confirmDisabled = loading || lastProfileLoading || !patient

  return (
    <Dialog
      open={open}
      onOpenChange={(next: boolean) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-[620px] overflow-y-auto sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-[22px] font-extrabold">{title}</DialogTitle>
          <DialogDescription className="text-sm font-semibold">
            Выберите пациента и параметры экзо-профиля. Профиль будет загружен на контроллер при старте.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label className="text-sm font-extrabold text-slate-700">Пациент</Label>
            {patients.length === 0 ? (
              <p className="m-0 text-sm font-semibold text-muted-foreground">Нет доступных пациентов</p>
            ) : (
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите пациента" />
                </SelectTrigger>
                <SelectContent>
                  {patients.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">
            {lastProfileLoading
              ? 'Загрузка профиля прошлой сессии…'
              : lastProfile
                ? `Параметры предзаполнены из сессии #${lastProfile.sessionNumber ?? '—'}${
                    lastProfile.sessionDate ? ` (${lastProfile.sessionDate})` : ''
                  }.${hasStoredCoeffs ? ' Baseline-коэффициенты сохранены.' : ''}`
                : 'Прошлых профилей нет — значения по умолчанию.'}
          </div>

          {includeAnthropometrics ? (
            <div className="grid gap-2">
              <Label className="text-sm font-extrabold text-slate-700">{t.workflow.sessionAnthropometrics}</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1">
                  <Label className="text-xs font-extrabold text-slate-600">{t.workflow.legLengthLeft}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={anthropometrics.leg_length_left ?? ''}
                    onChange={setAnthro('leg_length_left')}
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs font-extrabold text-slate-600">{t.workflow.legLengthRight}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={anthropometrics.leg_length_right ?? ''}
                    onChange={setAnthro('leg_length_right')}
                  />
                </div>
                <div className="col-span-2 grid gap-1">
                  <Label className="text-xs font-extrabold text-slate-600">{t.workflow.bodyweight}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={anthropometrics.bodyweight ?? ''}
                    onChange={setAnthro('bodyweight')}
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {EXO_PARAM_FIELDS.map((field) => (
              <div key={field.key} className="grid gap-1">
                <Label className="text-xs font-extrabold text-slate-600">{field.label}</Label>
                <Input
                  type="number"
                  step={field.step}
                  value={params[field.key]}
                  onChange={setParam(field.key)}
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1">
              <Label className="text-xs font-extrabold text-slate-600">Режим (mode)</Label>
              <Select
                value={structural.mode}
                onValueChange={(value) =>
                  setStructural((prev) => ({ ...prev, mode: value as ExoMode }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="position">position</SelectItem>
                  <SelectItem value="torque">torque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2 pb-2">
              <Checkbox
                id="exo-aan"
                checked={structural.aan}
                onCheckedChange={(checked) =>
                  setStructural((prev) => ({ ...prev, aan: checked === true }))
                }
              />
              <Label htmlFor="exo-aan" className="text-sm font-semibold text-slate-700">
                AAN (assist-as-needed)
              </Label>
            </div>
          </div>

          <div className="grid gap-2 rounded-2xl bg-slate-50 p-3">
            <span className="text-xs font-extrabold text-slate-600">Суставы: ROM (°) и enable</span>
            <div className="grid gap-2">
              {EXO_JOINTS.map(({ idx, label }) => (
                <div key={idx} className="grid grid-cols-[88px_1fr_1fr_auto] items-center gap-2">
                  <span className="text-xs font-extrabold text-slate-700">{label}</span>
                  <Input
                    type="number"
                    step={1}
                    aria-label={`${label} ROM min`}
                    value={structural.rom[idx]?.[0] ?? DEFAULT_EXO_ROM[idx][0]}
                    onChange={setRomBound(idx, 0)}
                  />
                  <Input
                    type="number"
                    step={1}
                    aria-label={`${label} ROM max`}
                    value={structural.rom[idx]?.[1] ?? DEFAULT_EXO_ROM[idx][1]}
                    onChange={setRomBound(idx, 1)}
                  />
                  <div className="flex items-center gap-1">
                    <Checkbox
                      id={`exo-enable-${idx}`}
                      checked={structural.enable[idx] ?? true}
                      onCheckedChange={(checked) =>
                        setStructural((prev) => ({
                          ...prev,
                          enable: { ...prev.enable, [idx]: checked === true },
                        }))
                      }
                    />
                    <Label htmlFor={`exo-enable-${idx}`} className="text-xs font-semibold text-slate-700">
                      on
                    </Label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <details className="rounded-2xl bg-slate-50 p-3">
            <summary className="cursor-pointer text-xs font-extrabold text-slate-600">Exo profile JSON</summary>
            <pre className="mt-2 max-h-48 overflow-auto text-xs leading-5 text-slate-700">{profileJsonPreview}</pre>
          </details>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" disabled={confirmDisabled} onClick={handleConfirm}>
            {loading ? 'Загрузка…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
