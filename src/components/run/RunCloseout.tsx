import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, BellRing, BookmarkPlus, CheckCircle2 } from 'lucide-react'
import type { Ticket, WorkflowRun } from '@/data/types'
import { getUser } from '@/data/users'
import type { TicketSession } from '@/state/types'
import type { RunItemView } from '@/state/runs'
import { Button, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { Spinner } from '@/components/ui/Spinner'
import { StatusBadge } from '@/components/ui/badges'
import { cn } from '@/lib/cn'

/**
 * The run's last screen: what happened, against what was estimated — then
 * two separate, separately-confirmed outcomes. Preventive notice and saving
 * the pattern are peers of the bulk fix, not footnotes to it.
 */
export function RunCloseout({
  run,
  items,
  notYetAffected,
  arrival,
  onNotify,
  onSave,
}: {
  run: WorkflowRun
  items: RunItemView[]
  notYetAffected: number
  /** The first ticket the saved workflow picked up on its own, once filed. */
  arrival?: { ticket: Ticket; session: TicketSession }
  onNotify: () => void
  onSave: () => void
}) {
  const [confirming, setConfirming] = useState<'notify' | 'save' | null>(null)
  const resolved = items.filter((row) => row.state === 'resolved')
  const handedBack = items.filter((row) => row.state === 'skipped')
  const within = resolved.filter((row) => row.session.resolution?.withinTarget).length

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-4 rounded-xl border border-step-done/40 bg-step-done-soft/30 p-5">
        <span className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-muted">
          <CheckCircle2 className="h-3.5 w-3.5 text-step-done" strokeWidth={2} />
          Close-out
        </span>
        <h2 className="text-[19px] font-semibold leading-snug text-ink">
          {resolved.length} of {items.length} resolved and verified
          {handedBack.length ? ` · ${handedBack.length} handed back` : ''}
        </h2>
        <p className="text-[14px] text-ink-muted">
          {resolved.length} requesters told what changed, {within} of {resolved.length} inside their
          resolution target. Figures are authored, not computed — this prototype has no clocks.
        </p>

        <table className="w-full text-left text-[13px]">
          <thead className="text-[12px] text-ink-faint">
            <tr>
              <th className="py-1.5 font-normal">Ticket</th>
              <th className="py-1.5 font-normal">Requester</th>
              <th className="py-1.5 font-normal">Resolution</th>
              <th className="py-1.5 text-right font-normal">Actual vs. target</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-subtle">
            {items.map(({ ticket, session, state }) => (
              <tr key={ticket.id} className="align-top">
                <td className="py-2 pr-3">
                  <Link to={`/t/${ticket.id}`} className={cn('font-mono text-[12px] text-ink-muted hover:text-ink', focusRing)}>
                    {ticket.key}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-ink">{getUser(ticket.requesterId).name}</td>
                <td className="py-2 pr-3 text-ink-muted">
                  {state === 'resolved' ? session.resolution?.causeLabel : 'Handed back to the ticket'}
                </td>
                <td className="py-2 text-right">
                  {session.resolution ? (
                    <span className={session.resolution.withinTarget ? 'text-step-done' : 'text-danger'}>
                      {session.resolution.timeToResolve} / {session.resolution.target}
                    </span>
                  ) : (
                    <StatusBadge status={session.status} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <OutcomeCard
          icon={<BellRing className="h-4 w-4" strokeWidth={1.75} />}
          title={`Tell the ${notYetAffected} not yet affected`}
          body="People in the rollout who have not filed. Queued when the first ticket resolved, held until the fix was proven at scale."
          done={run.notifiedCohort ? `Sent to ${notYetAffected} people in Slack.` : undefined}
          confirming={confirming === 'notify'}
          confirmCopy={`Messages ${notYetAffected} people in Slack with the sign-in command before their accounts are enrolled. It cannot be unsent.`}
          actionLabel="Send the notice"
          onStart={() => setConfirming('notify')}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            onNotify()
            setConfirming(null)
          }}
        />
        <OutcomeCard
          icon={<BookmarkPlus className="h-4 w-4" strokeWidth={1.75} />}
          title="Run this workflow on new matches"
          body="The workflow built from your fix stays on. The next ticket that matches is resolved the same way, without waiting for someone to pick it up."
          done={run.savedWorkflowId ? 'On. New matches above 0.80 run without asking.' : undefined}
          confirming={confirming === 'save'}
          confirmCopy="This is a standing approval: the agent will enroll matching accounts and message their owners without asking you first — enrollment included. Revoke it from Workflows at any time."
          actionLabel="Turn on and allow"
          onStart={() => setConfirming('save')}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            onSave()
            setConfirming(null)
          }}
        />
      </div>

      {run.savedWorkflowId ? <ArrivalWatch arrival={arrival} /> : null}
    </div>
  )
}

function OutcomeCard({
  icon,
  title,
  body,
  done,
  confirming,
  confirmCopy,
  actionLabel,
  onStart,
  onCancel,
  onConfirm,
}: {
  icon: React.ReactNode
  title: string
  body: string
  done?: string
  confirming: boolean
  confirmCopy: string
  actionLabel: string
  onStart: () => void
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-canvas p-5">
      <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
        <span className="text-ink-muted">{icon}</span>
        {title}
      </span>
      <p className="text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {done ? (
        <Note tone="ok">{done}</Note>
      ) : confirming ? (
        <div className="flex flex-col gap-3">
          <Note tone="warn">{confirmCopy}</Note>
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={onConfirm}>
              {actionLabel}
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="subtle" className="self-start" onClick={onStart}>
          {actionLabel}…
        </Button>
      )}
    </section>
  )
}

/** The loop, closed: a ticket nobody touched. */
function ArrivalWatch({ arrival }: { arrival?: { ticket: Ticket; session: TicketSession } }) {
  if (!arrival) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
        <Spinner />
        Watching the queue for the next match…
      </span>
    )
  }
  const { ticket, session } = arrival
  const resolved = session.status === 'resolved'
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-canvas p-5">
      <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">New match · just filed</span>
      <div className="flex items-center gap-3">
        <Link
          to={`/t/${ticket.id}`}
          className={cn('inline-flex flex-1 items-center gap-1 text-[14px] font-medium text-ink hover:underline', focusRing)}
        >
          {ticket.title}
          <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint" strokeWidth={1.75} />
        </Link>
        <StatusBadge status={session.status} />
      </div>
      <p className="text-[13px] text-ink-muted">
        {getUser(ticket.requesterId).name} filed it after the workflow was saved.{' '}
        {resolved
          ? 'The agent matched it, enrolled the account, told them, saw the sign-in and resolved it. Nobody touched it.'
          : 'The agent matched it and is running the saved workflow now — open it to watch the steps advance.'}
      </p>
    </section>
  )
}
