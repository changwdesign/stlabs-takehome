import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { patterns } from '@/data/patterns'
import { useRuns } from '@/state/SessionProvider'
import { runForSource } from '@/state/runs'

/**
 * Demo entrance to the bulk flow. Resolves the pattern's source ticket by
 * playing its real single-ticket path through the reducer — the rail unlocks
 * the same way it would after clicking through — then lands on the cohort
 * panel, or on the run if one already exists.
 */
export function BulkEntry() {
  const navigate = useNavigate()
  const [state, dispatchRun] = useRuns()
  const source = patterns[0]?.sourceTicketId
  const existing = source ? runForSource(state, source) : undefined

  useEffect(() => {
    if (!source) {
      navigate('/', { replace: true })
      return
    }
    if (existing) {
      navigate(`/workflows/runs/${existing.id}`, { replace: true })
      return
    }
    // Idempotent: a ticket that is already resolved is left alone.
    dispatchRun({ type: 'FAST_FORWARD_RESOLVE', ticketId: source })
    navigate(`/t/${source}?bulk=open`, { replace: true })
  }, [source, existing, dispatchRun, navigate])

  return null
}
