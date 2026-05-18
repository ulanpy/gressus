import { useEffect, useState } from 'react'
import type { GeometryPayload, InsoleSize } from '../types/insole'


export function useGeometry(size: InsoleSize) {
  const [geometry, setGeometry] = useState<GeometryPayload | null>(null)
  const [status, setStatus] = useState('подключение')

  useEffect(() => {
    let ignore = false

    fetch(`/api/geometry?size=${size}`)
      .then((response) => response.json())
      .then((payload: GeometryPayload) => {
        if (!ignore) {
          setGeometry(payload)
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatus('бэкенд недоступен')
        }
      })

    return () => {
      ignore = true
    }
  }, [size])

  return { geometry, setStatus, status }
}
