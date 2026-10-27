import { Link } from 'react-router-dom'
import type { RunItemState, Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import type { TicketSession } from '@/state/types'
import { currentStep } from '@/state/selectors'
import type { RunItemView } from '@/state/runs'
import { Avatar } from '@/components/ui/Avatar'
import { focusRing } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { RunItemBadge, StepDots } from './RunBadges'

/** One line of "where is this ticket", read off the ticket's own session. */
export function itemDetail(state: RunItemState, ticket: Ticket, session: TicketSession): string {
  const steps = ticket.suggestion?.steps ?? []
  switch (state) {
    case 'queued':
      return 'Queued — starts in a moment'
    case 'resolved':
      return `Resolved in ${session.resolution?.timeToResolve ?? '—'} against a ${session.resolution?.target ?? '—'} target`
    case 'skipped':
      return 'Handed back — continues on the ticket, one step at a time'
    case 'failed':
      return session.failed?.label ?? 'Failed'
    case 'awaiting_verification':
      return session.hold?.spec.label ??
        steps.find((s) => s.verification?.id === session.verify?.checkId)?.verification?.label ??
        'Verifying'
    default: {
      const running = steps.find((s) => session.steps[s.id] === 'running')
      if (running) return running.runLabel ?? `Running ${running.label.toLowerCase()}…`
      const step = currentStep(ticket, session)
      if (!step) return 'Wrapping up'
      const n = steps.indexOf(step) + 1
      return state === 'needs_input' ? `Step ${n} · ${step.label} — needs you` : `Step ${n} · ${step.label}`
    }
  }
}

export function stepStates(ticket: Ticket, session: TicketSession) {
  return (ticket.suggestion?.steps ?? []).map((step) => {
    if (session.failed?.stepId === step.id) return 'failed' as const
    if (session.verify?.state === 'watching' && session.verify.checkId === step.verification?.id) {
      return 'running' as const
    }
    return session.steps[step.id] ?? 'pending'
  })
}

export function RunProgressList({ items }: { items: RunItemView[] }) {
  return (
    <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
      {items.map(({ ticket, session, state }) => {
        const requester = getUser(ticket.requesterId)
        return (
          <li key={ticket.id} className="flex items-center gap-4 px-4 py-3">
            <Avatar user={requester} size="md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <Link
                to={`/t/${ticket.id}`}
                className={cn('truncate text-[13px] font-medium text-ink hover:underline', focusRing)}
              >
                {ticket.title}
              </Link>
              <span className="truncate text-[12px] text-ink-muted">
                <span className="font-mono text-ink-faint">{ticket.key}</span> · {requester.name} ·{' '}
                {itemDetail(state, ticket, session)}
              </span>
            </div>
            <StepDots states={stepStates(ticket, session)} />
            <RunItemBadge state={state} className="w-[108px] justify-center whitespace-nowrap" />
          </li>
        )
      })}
    </ul>
  )
}
