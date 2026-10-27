import { ArrowRight, Lock } from 'lucide-react'
import type { Ticket } from '@/data/types'
import type { CohortView } from '@/state/selectors'
import { Button, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { PriorityBadge, StatusBadge } from '@/components/ui/badges'
import { cn } from '@/lib/cn'

/* ---------------- rows ---------------- */

/** Every candidate shows its match reason. No unexplained inclusions. */
export function RelatedTicketRow({
  ticket,
  reason,
  confidence,
  included,
  onSelect,
}: {
  ticket: Ticket
  reason: string
  confidence: number
  /** Above the cohort threshold → counted in the bulk action. */
  included: boolean
  onSelect?: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(ticket.id)}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-raised/40',
        focusRing,
      )}
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 font-mono text-[10px] leading-none',
            included ? 'bg-step-done-soft text-step-done' : 'bg-surface-pill text-ink-faint',
          )}
          title={included ? 'Above the match threshold' : 'Below the match threshold — opt-in only'}
        >
          {confidence.toFixed(2)}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{ticket.title}</span>
        <PriorityBadge priority={ticket.priority} />
      </span>
      <span className="flex items-center gap-2 pl-[2px]">
        <StatusBadge status={ticket.status} />
      </span>
      <span className="text-[12px] leading-snug text-ink-muted">{reason}</span>
    </button>
  )
}

/**
 * Visible from the start, locked until one resolution is verified. Prove the
 * pattern on a single ticket, then generalize — and say so, rather than
 * showing a dead button.
 */
export function BulkActionLock({
  count,
  unlocked,
  onApply,
  run,
  onOpenRun,
  applyOpen,
  actionElsewhere = false,
}: {
  count: number
  unlocked: boolean
  onApply?: () => void
  /** A run this resolution already started — the action becomes a way back to it. */
  run?: { id: string; summary: string }
  onOpenRun?: () => void
  /** For `aria-expanded` on the trigger: the panel it opens is an overlay. */
  applyOpen?: boolean
  /**
   * The built-workflow card pinned under the section header already carries
   * the apply / open-run action, so only the explanation is shown here.
   */
  actionElsewhere?: boolean
}) {
  if (run && actionElsewhere) return <Note tone="muted">{run.summary}</Note>

  if (run) {
    return (
      <div className="flex flex-col gap-2">
        <Button
          variant="subtle"
          className="self-start"
          icon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={onOpenRun}
        >
          View {run.id}
        </Button>
        <Note tone="muted">{run.summary}</Note>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 rounded-lg border border-line-subtle bg-surface-raised/20 px-3 py-2 text-[13px] text-lock">
          <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
          Resolve {count} together
        </span>
        <Note tone="locked">
          Unlocks once this ticket is resolved and verified. One proven fix before it is offered to
          {' '}
          {count} more.
        </Note>
      </div>
    )
  }

  const note = (
    <Note tone="muted">
      Bulk moves each ticket to verification, never straight to Resolved — every one still
      verifies individually. Nothing runs until you confirm a dry run.
    </Note>
  )
  if (actionElsewhere) return note

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="primary"
        className="self-start"
        icon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
        onClick={onApply}
        aria-expanded={applyOpen}
        aria-haspopup="dialog"
      >
        Apply this resolution to {count} tickets
      </Button>
      {note}
    </div>
  )
}

/* ---------------- section ---------------- */

export function CohortSectionView({
  view,
  bulkUnlocked,
  bulkAvailable = true,
  onSelect,
  onApply,
  applyOpen,
  run,
  onOpenRun,
  actionElsewhere,
}: {
  view: CohortView
  bulkUnlocked: boolean
  /** Only the ticket whose resolution became the pattern offers bulk. */
  bulkAvailable?: boolean
  onSelect?: (id: string) => void
  onApply?: () => void
  applyOpen?: boolean
  run?: { id: string; summary: string }
  onOpenRun?: () => void
  /** See `BulkActionLock`. */
  actionElsewhere?: boolean
}) {
  const { cohort, size, candidates, nearMisses } = view

  return (
    <div className="flex flex-col gap-3 pl-6">
      <p className="text-[13px] leading-snug text-ink">
        <span className="font-semibold">{size} tickets</span> from the {cohort?.label}.
      </p>
      <p className="text-[12px] leading-snug text-ink-muted">{cohort?.cause}</p>

      {bulkAvailable ? (
        <BulkActionLock
          count={candidates.length}
          unlocked={bulkUnlocked}
          onApply={onApply}
          applyOpen={applyOpen}
          run={run}
          onOpenRun={onOpenRun}
          actionElsewhere={actionElsewhere}
        />
      ) : null}

      <div className="flex flex-col gap-0.5">
        <h4 className="px-2 pt-1 text-[12px] text-ink-muted">
          Matched at {cohort?.threshold.toFixed(2)} or above · {candidates.length}{' '}
          {candidates.length === 1 ? 'ticket' : 'tickets'}
        </h4>
        {candidates.map((row) => (
          <RelatedTicketRow
            key={row.ticket.id}
            ticket={row.ticket}
            reason={row.reason}
            confidence={row.confidence}
            included
            onSelect={onSelect}
          />
        ))}
      </div>

      {nearMisses.length ? (
        <div className="flex flex-col gap-0.5 border-t border-line-subtle pt-2">
          <h4 className="px-2 text-[12px] text-ink-muted">
            Listed, not included — below the threshold
          </h4>
          {nearMisses.map((row) => (
            <RelatedTicketRow
              key={row.ticket.id}
              ticket={row.ticket}
              reason={row.reason}
              confidence={row.confidence}
              included={false}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
