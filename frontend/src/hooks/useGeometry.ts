import { useMemo, useState } from 'react'
import type { InsoleSize } from '../types/insole'
import { getInsoleGeometry } from '../constants/insoleGeometry'

export function useGeometry(size: InsoleSize) {
  const geometry = useMemo(() => getInsoleGeometry(size), [size])
  const [status, setStatus] = useState('ожидание запуска')

  return { geometry, setStatus, status }
}
