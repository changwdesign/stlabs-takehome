import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Eye, Flag, Link2, Users } from 'lucide-react'
import type { Priority, Status, Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import { Avatar } from '@/components/ui/Avatar'
import { MetaField, Pill } from '@/components/ui/Pill'
import { StatusRing, statusMeta } from '@/components/ui/badges'
import { IconButton, focusRing } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { CURRENT_USER } from '@/state/viewer'
import { RequesterCard } from './RequesterCard'

/**
 * `status` is passed in rather than read off the ticket: the fixture holds the
 * seeded value and the session holds the live one, and the header must show
 * the live one the instant work starts.
 */
export function TicketHeader({ ticket, status }: { ticket: Ticket; status?: Status }) {
  const live = status ?? ticket.status
  const assignee = getUser(ticket.assigneeId)
  const requester = getUser(ticket.requesterId)

  return (
    <header className="flex flex-col gap-5">
      <TicketTitle
        ticket={ticket}
        actions={
          <Link
            to={`/t/${ticket.id}?as=requester`}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink',
              focusRing,
            )}
          >
            <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
            View as requester
          </Link>
        }
      />

      {/* Three groups, split by rules: where the ticket is (Status), how it is
          routed (Priority and Queue share one capsule, since together they
          pick the SLA policy), and who it is between (the assignee, working
          for the requester). Each rule sits in the gap before its group; when
          a group wraps to the start of a line its rule lands left of the row
          and the clip hides it. The clip only trims the left edge, and only
          past the 4px focus ring, so popovers are untouched; z-10 keeps the
          requester card above the content below despite the stacking context
          the clip creates. */}
      <div className="relative z-10 flex flex-wrap items-end gap-x-8 gap-y-3 [clip-path:inset(-100vh_-100vw_-100vh_-4px)]">
        <MetaField label="Status">
          <StatusPill status={live} />
        </MetaField>

        <MetaGroup>
          <MetaField label="Priority">
            <PriorityPill priority={ticket.priority} className="z-10 rounded-r-none pr-1.5" />
          </MetaField>
          {/* -ml-px lays the queue half's ring under the priority half's, so
              the seam is one tinted line rather than two. */}
          <MetaField label="Queue">
            <Pill
              icon={<Users className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />}
              className="-ml-px rounded-l-none"
            >
              {ticket.queue}
            </Pill>
          </MetaField>
        </MetaGroup>

        <MetaGroup className="gap-2.5">
          <MetaField label="Assignee">
            <Pill lead="avatar" icon={<Avatar user={assignee} size="sm" />}>
              {assignee.id === CURRENT_USER ? 'You' : assignee.name}
            </Pill>
          </MetaField>
          <span className="flex h-7 items-center text-[13px] text-ink-muted">for</span>
          <MetaField label="Requested by">
            <RequesterCard user={requester} />
          </MetaField>
        </MetaGroup>
      </div>
    </header>
  )
}

/**
 * Key row and title — the part of the header every view of a ticket shares,
 * the requester's portal included. `actions` sits at the right of the key row.
 */
export function TicketTitle({ ticket, actions }: { ticket: Ticket; actions?: ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[13px] text-ink-muted"># {ticket.key}</span>
        <IconButton label="Copy link" className="h-6 w-6">
          <Link2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        </IconButton>
        {actions}
      </div>

      <h1 className="max-w-[46ch] text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] text-ink">
        {ticket.title}
      </h1>
    </>
  )
}

/**
 * Pinned to the top of the detail column once the full header has scrolled
 * away, so Status and Priority stay in reach on a long ticket. It renders the
 * same pills from the same live state — never a second copy on screen, since
 * it only shows while the header itself is out of view. `visibility` (not just
 * opacity) takes the hidden pills out of the tab order.
 */
export function CompactTicketHeader({
  ticket,
  status,
  visible,
  onTitleClick,
}: {
  ticket: Ticket
  status?: Status
  visible: boolean
  /** Scrolls back up to the full header. */
  onTitleClick?: () => void
}) {
  const live = status ?? ticket.status
  return (
    // h-0 + -mb-7 cancels the article's gap, so the bar takes no space until
    // it pins; -ml-8/-mr-6 reach the article's edges.
    <div className="sticky top-0 z-20 -mb-7 -ml-8 -mr-6 h-0">
      <div
        aria-hidden={!visible}
        className={cn(
          'flex h-11 items-center gap-3 border-b border-line-subtle bg-canvas pl-8 pr-6 transition-[opacity,transform,visibility] duration-150',
          visible ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0',
        )}
      >
        <button
          type="button"
          onClick={onTitleClick}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-2 rounded-md text-left',
            focusRing,
          )}
        >
          <span className="shrink-0 font-mono text-[12px] text-ink-muted">{ticket.key}</span>
          <span className="truncate text-[14px] font-medium text-ink">{ticket.title}</span>
        </button>
        <StatusPill status={live} />
        <PriorityPill priority={ticket.priority} />
      </div>
    </div>
  )
}

/** A run of meta fields that belong together, with a rule in the gap before it. */
function MetaGroup({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('relative flex items-end', className)}>
      <span aria-hidden className="absolute -left-[16.5px] bottom-1.5 h-4 w-px bg-line" />
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: Status }) {
  return (
    <Pill lead="ring" icon={<StatusRing status={status} />}>
      {statusMeta[status].label}
    </Pill>
  )
}

/** Priority gets its own pill so the chip tint carries into the dropdown. */
const priorityPill: Record<Priority, string> = {
  P1: 'bg-p1-soft text-p1 ring-p1/25',
  P2: 'bg-p2-soft text-p2 ring-p2/25',
  P3: 'bg-p3-soft text-p3 ring-p3/20',
  P4: 'bg-p4-soft text-p4 ring-p4/25',
  P5: 'bg-p5-soft text-p5 ring-p5/25',
}

function PriorityPill({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        'relative inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-[13px] font-medium leading-none ring-1 ring-inset transition-colors hover:brightness-125',
        focusRing,
        priorityPill[priority],
        className,
      )}
    >
      <Flag className="h-4 w-4" strokeWidth={1.75} />
      {priority}
      <ChevronDown className="-ml-0.5 h-3.5 w-3.5 opacity-70" />
    </button>
  )
}
