import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowUpRight, Hand, RotateCcw, ShieldCheck, Undo2 } from 'lucide-react'
import { getUser } from '@/data/users'
import type { SessionAction } from '@/state/types'
import type { RunItemView } from '@/state/runs'
import { currentStep } from '@/state/selectors'
import { Button, focusRing } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { RichText } from '@/components/ui/RichText'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

function OpenTicket({ id }: { id: string }) {
  return (
    <Link
      to={`/t/${id}`}
      className={cn('inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink', focusRing)}
    >
      Open ticket
      <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
    </Link>
  )
}

/**
 * Where the run needs Grant. Seven-for-seven is the unrealistic case, so
 * exceptions get the loud surface — and every row has a way forward that
 * doesn't stall the rest of the batch.
 */
export function ExceptionsList({
  items,
  onTicket,
  onHandBack,
}: {
  items: RunItemView[]
  onTicket: (ticketId: string, action: SessionAction) => void
  onHandBack: (ticketId: string) => void
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-accent-soft/40 p-5">
      <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
        Needs you · {items.length}
      </span>
      <p className="-mt-2 text-[14px] text-ink-muted">The rest of the batch keeps going while these wait.</p>
      <ul className="flex flex-col gap-3">
        {items.map(({ ticket, session, state }) => {
          const requester = getUser(ticket.requesterId)
          const step = currentStep(ticket, session)
          return (
            <li key={ticket.id} className="flex flex-col gap-2.5 rounded-lg border border-line bg-canvas p-4">
              <div className="flex items-center gap-2">
                {state === 'failed' ? (
                  <AlertTriangle className="h-4 w-4 text-danger" strokeWidth={1.75} />
                ) : (
                  <Hand className="h-4 w-4 text-step-confirm" strokeWidth={1.75} />
                )}
                <span className="flex-1 text-[14px] font-medium text-ink">
                  {state === 'failed' ? session.failed?.label : step?.label}
                  <span className="font-normal text-ink-muted"> · {requester.name}</span>
                </span>
                <OpenTicket id={ticket.id} />
              </div>

              {state === 'failed' && session.failed ? (
                <>
                  <p className="text-[13px] leading-relaxed text-ink-muted">{session.failed.detail}</p>
                  {(session.attempts[session.failed.stepId] ?? 0) > 1 ? (
                    <p className="text-[12px] text-step-confirm">
                      Failed {session.attempts[session.failed.stepId]} times. Retrying won’t help until{' '}
                      {requester.name.split(' ')[0]} acts — hand it back and pick it up on the ticket.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="subtle"
                      icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      onClick={() => onTicket(ticket.id, { type: 'RETRY_STEP', stepId: session.failed!.stepId })}
                    >
                      Retry
                    </Button>
                    <Button
                      variant="subtle"
                      icon={<Undo2 className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      onClick={() => onHandBack(ticket.id)}
                    >
                      Hand back to the ticket
                    </Button>
                  </div>
                </>
              ) : null}

              {state === 'needs_input' && step ? (
                <>
                  <p className="text-[13px] leading-relaxed text-ink-muted">
                    <RichText segments={step.body} />
                  </p>
                  {step.actor === 'agent' ? (
                    // Pulled back behind an approval in the proposed workflow.
                    <Button
                      variant="subtle"
                      className="self-start"
                      icon={<ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />}
                      onClick={() => onTicket(ticket.id, { type: 'APPROVE_STEP', stepId: step.id })}
                    >
                      Approve and run
                    </Button>
                  ) : (
                    <Checkbox
                      checked={false}
                      onChange={() => onTicket(ticket.id, { type: 'MARK_STEP_DONE', stepId: step.id })}
                      label={<span className="text-ink">Done — I’ve made the change. Carry on.</span>}
                    />
                  )}
                </>
              ) : null}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Bulk moves tickets to verification, never straight to Resolved. Automatic
 * checks watch on their own; the rest are holds with a visible cadence.
 */
export function VerificationWatchList({
  items,
  onTicket,
}: {
  items: RunItemView[]
  onTicket: (ticketId: string, action: SessionAction) => void
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] text-ink-muted">Verifying · {items.length}</h2>
      <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
        {items.map(({ ticket, session }) => {
          const requester = getUser(ticket.requesterId)
          const first = requester.name.split(' ')[0]
          const check = ticket.suggestion?.steps.find(
            (s) => s.verification?.id === session.verify?.checkId,
          )?.verification
          const hold = session.hold
          return (
            <li key={ticket.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[13px] font-medium text-ink">
                  {requester.name} <span className="font-mono text-[12px] font-normal text-ink-faint">{ticket.key}</span>
                </span>
                <OpenTicket id={ticket.id} />
              </div>
              {hold ? (
                <>
                  <p className="text-[13px] text-ink-muted">
                    {hold.spec.label}. Resolution SLA paused.
                    {hold.spec.cadence ? <span className="text-ink-faint"> {hold.spec.cadence}</span> : null}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="subtle" onClick={() => onTicket(ticket.id, { type: 'RESUME' })}>
                      {first} confirmed
                    </Button>
                    {hold.nudgesSent < 2 ? (
                      <Button variant="ghost" onClick={() => onTicket(ticket.id, { type: 'SEND_NUDGE' })}>
                        Send a nudge ({2 - hold.nudgesSent} left)
                      </Button>
                    ) : (
                      <span className="text-[12px] text-ink-faint">Both nudges sent — auto-resolves next, reopen-on-reply.</span>
                    )}
                  </div>
                </>
              ) : (
                <span className="inline-flex items-center gap-2 text-[13px] text-step-running">
                  <Spinner />
                  {check?.label ?? 'Watching'} — {first} isn’t asked anything
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
