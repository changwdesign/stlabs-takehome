import { ArrowUpRight, MessageSquareReply, UserRoundCog } from 'lucide-react'
import type { Candidate, Status, Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import { Avatar } from '@/components/ui/Avatar'
import { Button, IconButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { PriorityBadge, StatusBadge } from '@/components/ui/badges'
import { cn } from '@/lib/cn'

/**
 * One ticket under review, built to be scanned down a list: a single line
 * that says which ticket and whose, then the one sentence that says why it is
 * (or isn't) in. The whole row toggles inclusion — reviewing eight tickets
 * should not mean aiming at eight 18px boxes.
 *
 * Owner only appears when it is the reason the row can't run; on every other
 * row it is Grant, and repeating that was noise.
 */
export function CandidateRow({
  ticket,
  candidate,
  status,
  checked,
  onToggle,
  onOpen,
  takeoverRequested = false,
  onRequestTakeover,
  onReply,
}: {
  ticket: Ticket
  candidate: Candidate
  status: Status
  /** Only actionable rows have a checkbox at all. */
  checked?: boolean
  onToggle?: (next: boolean) => void
  onOpen?: () => void
  takeoverRequested?: boolean
  onRequestTakeover?: () => void
  onReply?: () => void
}) {
  const requester = getUser(ticket.requesterId)
  const owner = getUser(ticket.assigneeId)
  const actionable = candidate.readiness === 'ready'
  const first = owner.name.split(' ')[0]

  return (
    <li
      onClick={actionable ? () => onToggle?.(!checked) : undefined}
      className={cn(
        'group flex gap-3 px-6 py-3 transition-colors',
        actionable && 'cursor-pointer hover:bg-surface-raised/30',
        actionable && checked && 'bg-surface-raised/20',
      )}
    >
      {/* Same 20px line as the title, so the box centres on it. Non-actionable
          rows keep the gutter so every title starts on one edge. */}
      <div className="flex h-5 w-[18px] shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
        {actionable ? (
          <Checkbox
            className="gap-0"
            checked={Boolean(checked)}
            onChange={(next) => onToggle?.(next)}
            label={<span className="sr-only">Include {ticket.key}</span>}
          />
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex h-5 items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-[14px] font-medium',
              actionable && !checked ? 'text-ink-muted' : 'text-ink',
            )}
          >
            {ticket.title}
          </span>
          <PriorityBadge priority={ticket.priority} />
          <IconButton
            label={`Open ${ticket.key}`}
            className="h-6 w-6 opacity-60 group-hover:opacity-100"
            onClick={(event) => {
              event.stopPropagation()
              onOpen?.()
            }}
          >
            <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Avatar user={requester} size="xs" />
            {requester.name}
          </span>
          <StatusBadge status={status} />
          <span
            className={cn('font-mono text-[11px]', candidate.defaultSelected ? 'text-step-done' : 'text-ink-faint')}
            title="Match confidence"
          >
            {candidate.confidence.toFixed(2)} match
          </span>
          {candidate.readiness === 'blocked_owner' ? (
            <span className="inline-flex items-center gap-1.5 text-step-confirm">
              <Avatar user={owner} size="xs" />
              Owned by {owner.name}
            </span>
          ) : null}
        </div>

        <p className="text-[13px] leading-snug text-ink-muted">{candidate.reason}</p>

        {candidate.readiness === 'blocked_owner' ? (
          takeoverRequested ? (
            <span className="pt-1 text-[12px] text-step-confirm">
              Takeover requested from {first} — stays out of this run until it lands.
            </span>
          ) : (
            <Button
              variant="subtle"
              className="mt-1 self-start"
              icon={<UserRoundCog className="h-3.5 w-3.5" strokeWidth={1.75} />}
              onClick={onRequestTakeover}
            >
              Request takeover from {first}
            </Button>
          )
        ) : null}

        {candidate.alternative === 'reply' ? (
          <Button
            variant="subtle"
            className="mt-1 self-start"
            icon={<MessageSquareReply className="h-3.5 w-3.5" strokeWidth={1.75} />}
            onClick={onReply}
          >
            Reply instead
          </Button>
        ) : null}
      </div>
    </li>
  )
}
