import type { CemrrInput } from '../../types/cemrr'

export type CemrrCsvParseResult = {
  inputs: CemrrInput[]
  headers: string[]
  rowCount: number
}

export class CemrrCsvParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CemrrCsvParseError'
  }
}

export function parseCemrrCsv(text: string): CemrrCsvParseResult {
  const lines = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (lines.length < 2) {
    throw new CemrrCsvParseError('CSV needs a header row and at least one data row')
  }

  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase())
  const rows: Record<string, string>[] = lines.slice(1).map((line) => {
    const cells = line.split(',').map((cell) => cell.trim())
    const row: Record<string, string> = {}
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? ''
    })
    return row
  })

  const filtered = rows.filter((row) => row.session || row.sess)
  if (filtered.length === 0) {
    throw new CemrrCsvParseError('No data rows with "session" or "sess" column')
  }

  const inputs = filtered.map(rowToInput)
  inputs.sort((a, b) => a.session - b.session)

  return { inputs, headers, rowCount: filtered.length }
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function rowToInput(row: Record<string, string>): CemrrInput {
  return {
    session: num(row.session ?? row.sess, 1),
    legM: num(row.leg_m, 0.62),
    vBelt: num(row.v_belt, 0.5),
    hsL: num(row.hs_l, 0),
    toL: num(row.to_l, 0.745),
    hsL2: num(row.hs_l2, 1.24),
    hsR: num(row.hs_r, 0.62),
    toR: num(row.to_r, 1.335),
    hsR2: num(row.hs_r2, 1.86),
    cvL: num(row.cv_l, 3),
    cvR: num(row.cv_r, 2),
    thL: num(row.thl, 28),
    thR: num(row.thr, 36),
    siBase: num(row.si_base, 20),
    cvBase: num(row.cv_base, 4.2),
    dsrBase: num(row.dsr_base, 36),
    pLTotal: num(row.pl_total ?? row.p_l, 156.9),
    pRTotal: num(row.pr_total ?? row.p_r, 129.3),
    fp: [
      num(row.fp_lh, 5.1),
      num(row.fp_rh, 4.6),
      num(row.fp_lk, 4.0),
      num(row.fp_rk, 3.7),
    ],
    fs: [
      num(row.fs_lh, 1.1),
      num(row.fs_rh, 1.0),
      num(row.fs_lk, 0.9),
      num(row.fs_rk, 0.85),
    ],
    dTheta: [
      num(row.d_thl ?? row.dthl, 4.0),
      num(row.d_thr ?? row.dthr, 0.3),
      num(row.d_tkl ?? row.dtkl, 3.5),
      num(row.d_tkr ?? row.dtkr, 0.2),
    ],
  }
}

export const CEMRR_REQUIRED_COLUMNS = [
  'session',
  'hs_l',
  'to_l',
  'hs_l2',
  'hs_r',
  'to_r',
  'hs_r2',
  'cv_l',
  'cv_r',
  'thl',
  'thr',
  'fp_lh',
  'fs_lh',
  'fp_rh',
  'fs_rh',
  'fp_lk',
  'fs_lk',
  'fp_rk',
  'fs_rk',
  'si_base',
  'cv_base',
  'dsr_base',
  'pl_total',
  'pr_total',
  'd_thl',
  'd_thr',
  'd_tkl',
  'd_tkr',
] as const
