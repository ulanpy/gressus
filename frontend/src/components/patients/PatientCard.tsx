import type { ReactNode } from 'react'
import { useI18n } from '../../i18n/context'
import type { Patient } from '../../types/patients'
import {
  formatPatientDateOfBirth,
  patientAgeYears,
  patientSexLabel,
} from '../../lib/patient/display'
import { cn } from '../../lib/cn'
import {
  ArrowsIcon,
  CalendarIcon,
  DocumentIcon,
  GenderIcon,
  HeartIcon,
  PersonIcon,
  PhoneIcon,
  ShieldIcon,
} from './PatientFieldIcons'

type PatientCardProps = {
  patient: Patient
  className?: string
}

type DataTileProps = {
  icon: ReactNode
  label: string
  value: string
}

function DataTile({ icon, label, value }: DataTileProps) {
  return (
    <div className="flex min-w-0 gap-3.5 rounded-xl border border-slate-200/90 bg-linear-to-br from-slate-50 to-sky-50/40 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/80">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-semibold leading-snug text-slate-600">{label}</p>
        <p className="m-0 mt-1 text-lg font-bold leading-tight tracking-[-0.01em] text-slate-900 wrap-break-word">
          {value}
        </p>
      </div>
    </div>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="m-0 mb-3 text-[15px] font-bold tracking-[-0.01em] text-slate-800">
      {children}
    </h4>
  )
}

function TileGrid({ children, columns = 3 }: { children: ReactNode; columns?: 2 | 3 }) {
  return (
    <div
      className={cn(
        'grid w-full gap-4',
        columns === 3
          ? 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'
          : 'grid-cols-1 sm:grid-cols-2',
      )}
    >
      {children}
    </div>
  )
}

export function PatientCard({ patient, className }: PatientCardProps) {
  const { t, language } = useI18n()

  const notSpecified = t.workflow.notSpecified
  const display = (value: string | null | undefined) => value?.trim() || notSpecified

  const age = patient.date_of_birth ? patientAgeYears(patient.date_of_birth) : null
  const dobFormatted = patient.date_of_birth
    ? formatPatientDateOfBirth(patient.date_of_birth, language)
    : null
  const dobDisplay =
    dobFormatted && age != null
      ? t.workflow.patientDobAge(dobFormatted, age)
      : dobFormatted ?? notSpecified

  const hasAnyData =
    patient.date_of_birth ||
    patient.sex !== 'unknown' ||
    patient.cp_type ||
    patient.affected_side ||
    patient.gmfcs_current ||
    patient.dominant_side ||
    patient.comorbidities ||
    patient.contraindications ||
    patient.consent_on_file ||
    patient.consent_date ||
    patient.guardian_contact ||
    patient.enrollment_date

  if (!hasAnyData) {
    return (
      <p className={cn('m-0 mt-2 text-sm text-muted', className)}>{t.workflow.noDemographics}</p>
    )
  }

  const consentValue = patient.consent_on_file ? t.workflow.consentYes : t.workflow.consentNo

  return (
    <div className={cn('w-full space-y-5', className)}>
      <section className="w-full">
        <SectionHeading>{t.workflow.sectionBasic}</SectionHeading>
        <TileGrid columns={2}>
          <DataTile icon={<CalendarIcon />} label={t.workflow.dateOfBirth} value={dobDisplay} />
          <DataTile
            icon={<GenderIcon />}
            label={t.workflow.sex}
            value={
              patient.sex !== 'unknown'
                ? patientSexLabel(patient.sex, t.workflow)
                : notSpecified
            }
          />
        </TileGrid>
      </section>

      <section className="w-full">
        <SectionHeading>{t.workflow.sectionClinical}</SectionHeading>
        <TileGrid columns={3}>
          <DataTile icon={<PersonIcon />} label={t.workflow.cpType} value={display(patient.cp_type)} />
          <DataTile
            icon={<ArrowsIcon />}
            label={t.workflow.affectedSide}
            value={display(patient.affected_side)}
          />
          <DataTile
            icon={<DocumentIcon />}
            label={t.workflow.gmfcsCurrent}
            value={display(patient.gmfcs_current)}
          />
          <DataTile
            icon={<ArrowsIcon />}
            label={t.workflow.dominantSide}
            value={display(patient.dominant_side)}
          />
          <DataTile
            icon={<HeartIcon />}
            label={t.workflow.comorbidities}
            value={display(patient.comorbidities)}
          />
          <DataTile
            icon={<ShieldIcon />}
            label={t.workflow.contraindications}
            value={display(patient.contraindications)}
          />
        </TileGrid>
      </section>

      <section className="w-full rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04)]">
        <SectionHeading>{t.workflow.sectionConsent}</SectionHeading>
        <div className="grid w-full grid-cols-1 gap-3 md:grid-cols-3">
          <DataTile icon={<ShieldIcon />} label={t.workflow.consentOnFile} value={consentValue} />
          <DataTile
            icon={<CalendarIcon />}
            label={t.workflow.consentDate}
            value={
              patient.consent_date
                ? formatPatientDateOfBirth(patient.consent_date, language)
                : notSpecified
            }
          />
          <DataTile
            icon={<PhoneIcon />}
            label={t.workflow.guardianContact}
            value={display(patient.guardian_contact)}
          />
        </div>
        <div className="mt-3 grid w-full grid-cols-1 md:grid-cols-3">
          <DataTile
            icon={<DocumentIcon />}
            label={t.workflow.enrollmentDate}
            value={
              patient.enrollment_date
                ? formatPatientDateOfBirth(patient.enrollment_date, language)
                : notSpecified
            }
          />
        </div>
      </section>
    </div>
  )
}
