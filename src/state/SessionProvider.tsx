import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Ticket } from '@/data/types'
import { getTicket, lateTickets, tickets } from '@/data/tickets'
import { DEFAULT_RUN_MS, ITEM_STAGGER_MS, ARRIVAL_MS, scaled } from './config'
import {
  SAVED_WORKFLOW_ID,
  initialRoot,
  rootReducer,
  type RootMessage,
  type RootState,
  type RunAction,
} from './runs'
import { seedSession } from './seed'
import type { SessionAction, TicketSession } from './types'

/**
 * Sessions are keyed by ticket id and seeded lazily from the fixture on first
 * use. Switching tickets resets nothing: a run started on tkt-1 is still there
 * after a trip to tkt-4 and back.
 *
 * Bulk runs live in the same state, because a run has no execution of its
 * own — it starts each ticket and then reads that ticket's session.
 */
const SessionContext = createContext<{
  state: RootState
  send: (message: RootMessage) => void
  /** Bumped by every demo reset; the routes are keyed on it so pages remount. */
  epoch: number
  resetDemo: () => void
} | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, send] = useReducer(rootReducer, initialRoot)

  /**
   * The fake-async engine. Two-phase dispatch keeps the reducer pure: an
   * action sets `running`, and this single effect owns the timer that fires
   * the completion.
   *
   * Timers live here, in a provider that never unmounts, so a run started
   * before a ticket switch finishes in the background — the honest behavior
   * for an agent executing server-side. The keyed map means a re-render can
   * never start a second timer for the same step, which is what would make
   * StrictMode advance a step twice.
   */
  const timers = useRef(new Map<string, number>())

  useEffect(() => {
    const schedule = (key: string, ms: number, message: RootMessage) => {
      if (timers.current.has(key)) return
      const handle = window.setTimeout(() => {
        timers.current.delete(key)
        send(message)
      }, ms)
      timers.current.set(key, handle)
    }

    for (const [ticketId, session] of Object.entries(state.sessions)) {
      const ticket = getTicket(ticketId)
      const steps = ticket?.suggestion?.steps ?? []

      for (const step of steps) {
        if (session.steps[step.id] !== 'running') continue
        // The attempt count is in the key: a retried step needs a fresh timer
        // even if the failed attempt's key was somehow still present.
        const attempt = session.attempts[step.id] ?? 0
        schedule(`${ticketId}:${step.id}:${attempt}`, scaled(step.runDurationMs ?? DEFAULT_RUN_MS), {
          ticketId,
          action: { type: 'COMPLETE_STEP', stepId: step.id },
        })
      }

      if (session.verify?.state === 'watching') {
        const { checkId } = session.verify
        const check = steps.find((step) => step.verification?.id === checkId)?.verification
        schedule(`${ticketId}:verify:${checkId}`, scaled(check?.durationMs ?? DEFAULT_RUN_MS), {
          ticketId,
          action: { type: 'VERIFICATION_PASSED', checkId },
        })
      }
    }

    // Items start staggered so the progress list reads as a wave rather than
    // every spinner starting at once. START_ITEM is a no-op once started.
    for (const run of Object.values(state.runs)) {
      if (run.phase !== 'confirmed') continue
      run.items.forEach((item, i) => {
        if (item.started || item.handedBack) return
        schedule(`${run.id}:${item.ticketId}`, scaled(400 + i * ITEM_STAGGER_MS), {
          run: { type: 'START_ITEM', runId: run.id, ticketId: item.ticketId },
        })
      })

      // Once the resolution is saved as a workflow, the next matching ticket
      // is filed — and nobody has to touch it.
      if (run.savedWorkflowId) {
        for (const late of lateTickets) {
          if (state.arrived.includes(late.id)) continue
          schedule(`arrive:${late.id}`, scaled(ARRIVAL_MS), {
            run: { type: 'ARRIVE', ticketId: late.id, workflowId: SAVED_WORKFLOW_ID },
          })
        }
      }
    }
    // Deliberately no cleanup: cancelling here on every state change is what
    // would kill a background run the moment Grant opens another ticket.
  }, [state])

  useEffect(() => {
    const map = timers.current
    return () => {
      map.forEach((handle) => window.clearTimeout(handle))
      map.clear()
    }
  }, [])

  /**
   * Demo control: back to a fresh load without a browser reload. Pending
   * timers go first — an arrival or item stagger scheduled before the reset
   * would otherwise fire into the fresh state.
   */
  const [epoch, setEpoch] = useState(0)
  const resetDemo = useCallback(() => {
    timers.current.forEach((handle) => window.clearTimeout(handle))
    timers.current.clear()
    send({ run: { type: 'DEMO_RESET' } })
    setEpoch((n) => n + 1)
  }, [])

  const value = useMemo(() => ({ state, send, epoch, resetDemo }), [state, epoch, resetDemo])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

function useRoot() {
  const context = useContext(SessionContext)
  if (!context) throw new Error('Session hooks must be used inside <SessionProvider>')
  return context
}

export function useSession(ticket: Ticket): [TicketSession, (action: SessionAction) => void] {
  const { state, send } = useRoot()
  const stored = state.sessions[ticket.id]
  const session = useMemo(() => stored ?? seedSession(ticket), [stored, ticket])
  const dispatch = useCallback(
    (action: SessionAction) => send({ ticketId: ticket.id, action }),
    [send, ticket.id],
  )
  return [session, dispatch]
}

/** Dispatch into any ticket's session — the run page acts on several at once. */
export function useTicketDispatch(): (ticketId: string, action: SessionAction) => void {
  const { send } = useRoot()
  return useCallback((ticketId, action) => send({ ticketId, action }), [send])
}

export function useRuns(): [RootState, (action: RunAction) => void] {
  const { state, send } = useRoot()
  const dispatch = useCallback((action: RunAction) => send({ run: action }), [send])
  return [state, dispatch]
}

/**
 * Live statuses for tickets we are not rendering in full. Resolving tkt-1 has
 * to flip its row in the list, which means the list cannot read the fixture.
 */
export function useLiveStatus(): (ticket: Ticket) => Ticket['status'] {
  const context = useContext(SessionContext)
  const sessions = context?.state.sessions
  return useCallback(
    (ticket: Ticket) => sessions?.[ticket.id]?.status ?? ticket.status,
    [sessions],
  )
}

/** Fixture tickets plus any late ones that have been filed since load. */
export function useAllTickets(): Ticket[] {
  const arrived = useContext(SessionContext)?.state.arrived
  return useMemo(
    () =>
      arrived?.length ? [...tickets, ...lateTickets.filter((t) => arrived.includes(t.id))] : tickets,
    [arrived],
  )
}

/** The demo reset, and the epoch the routes key on so every page remounts. */
export function useDemoReset(): { epoch: number; resetDemo: () => void } {
  const { epoch, resetDemo } = useRoot()
  return { epoch, resetDemo }
}
