export type RuntimeJobName = 'exo'

export type RuntimeActiveJob = {
  name: RuntimeJobName
  command: string[]
  pid: number
  uptimeS: number
} | null

export type RuntimePayload = {
  state: 'idle' | 'running'
  activeJob: RuntimeActiveJob
  lastExit: {
    name: RuntimeJobName | null
    code: number | null
    finishedAt: number
  } | null
}
