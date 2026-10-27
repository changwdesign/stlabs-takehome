import { useState } from 'react'
import { ChevronDown, ShieldAlert } from 'lucide-react'
import type { WorkflowRun } from '@/data/types'
import { getUser } from '@/data/users'
import type { RunItemView } from '@/state/runs'
import { Avatar } from '@/components/ui/Avatar'
import { Button, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { RichText } from '@/components/ui/RichText'
import { cn } from '@/lib/cn'

/**
 * Everything a batch confirm commits to, on one screen: the dry run's
 * finding per ticket, every account whose sign-in changes, and the exact
 * message each requester receives. One confirm — placed at the boundary
 * where commitment actually happens.
 */
export function PreflightPanel({
  run,
  items,
  onConfirm,
  onCancel,
}: {
  run: WorkflowRun
  items: RunItemView[]
  onConfirm: () => void
  onCancel: () => void
}) {
  const [openMessage, setOpenMessage] = useState<string | null>(items[0]?.ticket.id ?? null)
  const devices = items.reduce((sum, { ticket }) => sum + (getUser(ticket.requesterId).deviceCount ?? 1), 0)
  const pauses = items.filter(({ ticket }) =>
    ticket.suggestion?.steps.some((s) => s.actor === 'assignee' && !s.notNeeded),
  )
  const asks = items.filter(({ ticket }) =>
    ticket.suggestion?.steps.some((s) => s.verification?.mode === 'requester'),
  )

  return (
    <div className="flex flex-col gap-7">
      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] text-ink-muted">Dry run</h2>
          <span className="text-[12px] text-ink-faint">Read-only lookup, nothing changed — the run repeats it as step 1</span>
        </div>
        <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
          {items.map(({ ticket }) => {
            const requester = getUser(ticket.requesterId)
            const steps = ticket.suggestion?.steps ?? []
            const check = steps.find((s) => s.id === 's-check')
            const manual = steps.find((s) => s.actor === 'assignee' && !s.notNeeded)
            const asksRequester = steps.some((s) => s.verification?.mode === 'requester')
            return (
              <li key={ticket.id} className="flex gap-3 px-4 py-3">
                <Avatar user={requester} size="md" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[13px] font-medium text-ink">
                    {requester.name} <span className="font-mono text-[12px] font-normal text-ink-faint">{ticket.key}</span>
                  </span>
                  {check?.outcome ? (
                    <p className="text-[13px] leading-snug text-ink-muted">
                      <RichText segments={check.outcome.body} />
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5 text-[12px]">
                    {manual ? (
                      <span className="text-step-confirm">Will pause for you at “{manual.label}”</span>
                    ) : (
                      <span className="text-ink-faint">Step 2 not needed</span>
                    )}
                    <span className="text-ink-faint">
                      {asksRequester
                        ? `Verifies by asking ${requester.name.split(' ')[0]}`
                        : 'Verifies automatically'}
                    </span>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[13px] text-ink-muted">What each requester receives</h2>
          <span className="text-[12px] text-ink-faint">{items.length} messages · public reply, mirrored to Slack</span>
        </div>
        <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
          {items.map(({ ticket, session }) => {
            const requester = getUser(ticket.requesterId)
            const notify = ticket.suggestion?.steps.find((s) => s.draft)
            const body = (notify && session.stepDrafts[notify.id]?.body) ?? notify?.draft?.body ?? ''
            const open = openMessage === ticket.id
            return (
              <li key={ticket.id}>
                <button
                  type="button"
                  onClick={() => setOpenMessage(open ? null : ticket.id)}
                  aria-expanded={open}
                  className={cn(
                    'flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] text-ink hover:bg-surface-raised/30',
                    focusRing,
                  )}
                >
                  <ChevronDown className={cn('h-3.5 w-3.5 text-ink-muted transition-transform', !open && '-rotate-90')} />
                  To {requester.name}
                  <span className="flex-1 truncate text-ink-faint">{body.split('\n')[0]}</span>
                </button>
                {open ? (
                  <pre className="mx-4 mb-4 whitespace-pre-wrap rounded-lg border border-line-subtle bg-canvas px-4 py-3 font-sans text-[13px] leading-relaxed text-ink-muted">
                    {body}
                  </pre>
                ) : null}
              </li>
            )
          })}
        </ul>
      </section>

      {/* The one loud surface on this page while the run is waiting on Grant. */}
      <section className="flex flex-col gap-4 rounded-xl border border-accent/40 bg-accent-soft/40 p-5">
        <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">One confirm for the batch</span>
        <h2 className="text-[19px] font-semibold leading-snug text-ink">
          Enroll {items.length} accounts and send {items.length} messages
        </h2>
        <Note tone="warn" icon={<ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />}>
          Changes the sign-in method on {items.length} other people’s accounts —{' '}
          {items.map(({ ticket }) => getUser(ticket.requesterId).name).join(', ')}. They are signed
          out of 1Password on {devices} devices in total and re-authenticate through Google.
        </Note>
        <ul className="flex flex-col gap-1 text-[13px] text-ink-muted">
          <li>
            · {pauses.length
              ? `Pauses for you on ${pauses.length} ticket${pauses.length > 1 ? 's' : ''} where the profile email needs fixing by hand.`
              : 'No ticket needs a manual step.'}
          </li>
          <li>
            · {asks.length
              ? `${asks.length} ticket${asks.length > 1 ? 's' : ''} can’t be verified automatically — the requester is asked, and the resolution clock pauses while they answer.`
              : 'Every ticket verifies automatically.'}
          </li>
          <li>· Each ticket resolves only after its own verification. Nothing jumps straight to Resolved.</li>
        </ul>
        <div className="flex items-center gap-2 pt-1">
          <Button variant="primary" onClick={onConfirm}>
            Confirm and run on {items.length} tickets
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel {run.id}
          </Button>
        </div>
      </section>
    </div>
  )
}
