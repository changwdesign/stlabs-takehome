import { useEffect, useRef, useState, type ReactNode } from 'react'
import { matchPath, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Headset, Layers, Play, RotateCcw, User, X } from 'lucide-react'
import { patterns } from '@/data/patterns'
import { useDemoReset, useRuns, useTicketDispatch } from '@/state/SessionProvider'
import { getTicket } from '@/data/tickets'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/lib/cn'

/** Hazard stripe along the panel's top edge — reads as "not the product" at a glance. */
const hazard = {
  backgroundImage:
    'repeating-linear-gradient(-45deg, var(--color-demo) 0 8px, var(--color-demo-ink) 8px 16px)',
}

/**
 * Presenter-only entry points into the two stories. Floats over every page in
 * hazard yellow so nobody mistakes it for product UI. Both entries reset the
 * in-memory state first, so each walkthrough starts from the same place.
 */
export function DemoControl() {
  const navigate = useNavigate()
  const { resetDemo } = useDemoReset()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const sourceId = patterns[0]?.sourceTicketId ?? 'tkt-1'

  // Whose eyes the ticket is seen through. Only the `as` param changes, so
  // the open ticket — and its session — carry across the switch untouched.
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const onTicket = Boolean(matchPath('/', location.pathname) || matchPath('/t/:ticketId', location.pathname))
  const viewAs: ViewAs = searchParams.get('as') === 'requester' ? 'requester' : 'assignee'

  // Requester states, played through the real reducer on the source ticket so
  // each one is a state the assignee could actually have left it in.
  const sendTo = useTicketDispatch()
  const [, dispatchRun] = useRuns()
  function showState(state: RequesterState) {
    if (state === 'other_hold') {
      navigate('/t/tkt-15?as=requester')
      return
    }
    sendTo(sourceId, { type: 'RESET' })
    if (state === 'in_progress' || state === 'waiting') sendTo(sourceId, { type: 'START' })
    const hold = getTicket(sourceId)?.hold
    if (state === 'waiting' && hold) sendTo(sourceId, { type: 'HOLD', spec: hold })
    if (state === 'resolved') dispatchRun({ type: 'FAST_FORWARD_RESOLVE', ticketId: sourceId })
    navigate(`/t/${sourceId}?as=requester`)
  }

  function switchView(next: ViewAs) {
    // Off a ticket (Workflows, a run), the switch is a way back to one: the
    // demo's ticket, in the view asked for.
    if (!onTicket) {
      setOpen(false)
      navigate(next === 'requester' ? `/t/${sourceId}?as=requester` : `/t/${sourceId}`)
      return
    }
    const params = new URLSearchParams(searchParams)
    if (next === 'requester') params.set('as', 'requester')
    else params.delete('as')
    setSearchParams(params)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    const onDown = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  function enter(to: string) {
    resetDemo()
    setOpen(false)
    navigate(to)
  }

  return (
    <div ref={root} className="fixed bottom-4 left-[76px] z-50 flex flex-col items-start gap-2">
      {open ? (
        <div
          role="dialog"
          aria-label="Demo controls"
          className="w-[320px] overflow-hidden rounded-xl border-2 border-dashed border-demo bg-demo-soft shadow-2xl shadow-black/50"
        >
          <div className="h-1.5" style={hazard} aria-hidden />
          <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-3">
            <div>
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-demo">
                Demo controls
              </p>
              <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">
                Presenter only — not part of the product.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close demo controls"
              className="rounded-md p-1 text-demo/70 hover:bg-demo/10 hover:text-demo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex flex-col gap-2 border-b border-dashed border-demo/40 px-4 pb-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-demo/70">
              View as
            </p>
            <Segmented
              label="View the ticket as"
              fill
              value={viewAs}
              onChange={switchView}
              options={[
                {
                  value: 'assignee',
                  label: 'Assignee',
                  icon: <Headset className="h-3.5 w-3.5" strokeWidth={1.75} />,
                },
                {
                  value: 'requester',
                  label: 'Requester',
                  icon: <User className="h-3.5 w-3.5" strokeWidth={1.75} />,
                },
              ]}
            />
            <p className="text-[12px] leading-snug text-ink-muted">
              {onTicket
                ? 'Same ticket, same live state. Switching does not reset anything.'
                : 'Opens the 1Password ticket in that view. Nothing is reset.'}
            </p>
          </div>

          {/* Each tab carries only its own controls: the requester tab sets the
              state the ticket is seen in, the assignee tab walks the flows. */}
          {onTicket && viewAs === 'requester' ? (
            <div className="flex flex-col gap-2 px-4 py-3">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-demo/70">
                Jump to a state
              </p>
              <div className="flex flex-wrap gap-1.5">
                {requesterStates.map((state) => (
                  <button
                    key={state.value}
                    type="button"
                    onClick={() => showState(state.value)}
                    className="rounded-md border border-demo/30 bg-canvas/60 px-2 py-1 text-[12px] text-ink transition-colors hover:border-demo hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo/60"
                  >
                    {state.label}
                  </button>
                ))}
              </div>
              <p className="text-[12px] leading-snug text-ink-muted">
                Resets the 1Password ticket and plays it to that state. "On hold" opens the
                offboarding ticket, which waits on People Ops.
              </p>
            </div>
          ) : (
            <>
            <div className="flex flex-col gap-2 px-3 py-3">
              <Entry
                step="1"
                icon={<Play className="h-4 w-4" strokeWidth={2} />}
                title="Resolve one ticket"
                detail="Opens the 1Password SSO ticket unstarted — take it, step through the plan, resolve."
                onClick={() => enter(`/t/${sourceId}`)}
              />
              <Entry
                step="2"
                icon={<Layers className="h-4 w-4" strokeWidth={2} />}
                title="Bulk ticket processing"
                detail="Fast-forwards that ticket to Resolved and opens the cohort panel to apply the fix to the other 7."
                onClick={() => enter('/bulk')}
              />
            </div>

            <div className="flex items-center gap-1.5 border-t border-dashed border-demo/40 px-4 py-2 text-[11px] text-demo/70">
              <RotateCcw className="h-3 w-3" />
              Sessions, runs and arrivals are cleared on entry.
            </div>
            </>
          )}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Demo controls"
        className={cn(
          'inline-flex items-center gap-2 rounded-full border-2 border-dashed border-demo-ink/40 bg-demo py-1.5 pl-2 pr-3.5',
          'font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-demo-ink shadow-lg shadow-black/40',
          'transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas',
        )}
      >
        <span className="h-4 w-4 rounded-full" style={hazard} aria-hidden />
        Demo
        {onTicket && viewAs === 'requester' ? <span className="opacity-60">· Requester</span> : null}
      </button>
    </div>
  )
}

type ViewAs = 'assignee' | 'requester'

type RequesterState = 'not_started' | 'in_progress' | 'waiting' | 'other_hold' | 'resolved'

const requesterStates: Array<{ value: RequesterState; label: string }> = [
  { value: 'not_started', label: 'Not started' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'waiting', label: 'Waiting on you' },
  { value: 'other_hold', label: 'On hold' },
  { value: 'resolved', label: 'Resolved' },
]

function Entry({
  step,
  icon,
  title,
  detail,
  onClick,
}: {
  step: string
  icon: ReactNode
  title: string
  detail: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-3 rounded-lg border border-demo/30 bg-canvas/60 p-3 text-left transition-colors hover:border-demo hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-demo/60"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-demo text-demo-ink">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
          {title}
          <span className="font-mono text-[10px] font-medium text-demo/70">Pass {step}</span>
        </span>
        <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">{detail}</span>
      </span>
    </button>
  )
}
