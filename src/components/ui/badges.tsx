import { Flag } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Priority, SlaTarget, Status } from '@/data/types'

/* ---------------------------------------------------------------
   Semantic chip pairs. Adding a priority or status is one entry
   here plus one token pair in index.css — never a new component.
   --------------------------------------------------------------- */

const priorityStyles: Record<Priority, string> = {
  P1: 'text-p1 bg-p1-soft ring-p1/25',
  P2: 'text-p2 bg-p2-soft ring-p2/25',
  P3: 'text-p3 bg-p3-soft ring-p3/20',
  P4: 'text-p4 bg-p4-soft ring-p4/25',
  P5: 'text-p5 bg-p5-soft ring-p5/25',
}

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none ring-1 ring-inset',
        priorityStyles[priority],
        className,
      )}
    >
      <Flag className="h-3 w-3" strokeWidth={1.75} />
      {priority}
    </span>
  )
}

export const statusMeta: Record<Status, { label: string; dot: string; chip: string }> = {
  open: {
    label: 'Open',
    dot: 'bg-status-open',
    chip: 'text-status-open bg-status-open-soft ring-status-open/25',
  },
  in_progress: {
    label: 'In progress',
    dot: 'bg-status-progress',
    chip: 'text-status-progress bg-status-progress-soft ring-status-progress/25',
  },
  on_hold: {
    label: 'On hold',
    dot: 'bg-status-on-hold',
    chip: 'text-status-on-hold bg-status-on-hold-soft ring-status-on-hold/25',
  },
  resolved: {
    label: 'Resolved',
    dot: 'bg-status-resolved',
    chip: 'text-status-resolved bg-status-resolved-soft ring-status-resolved/25',
  },
  closed: {
    label: 'Closed',
    dot: 'bg-status-closed',
    chip: 'text-status-closed bg-status-closed-soft ring-status-closed/25',
  },
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-status-cancelled',
    chip: 'text-status-cancelled bg-status-cancelled-soft ring-status-cancelled/25',
  },
}

/**
 * The header's status mark: a 16px hollow ring, inset concentric with the
 * pill like the avatars (`lead="ring"`). The colour comes from the status's
 * chip text token.
 */
export function StatusRing({ status }: { status: Status }) {
  const text = statusMeta[status].chip.split(' ').find((c) => c.startsWith('text-'))
  return (
    <span className={cn('h-4 w-4 shrink-0 rounded-full border-[1.5px] border-current', text)} />
  )
}

/** The ring-style status badge used in list rows. */
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const meta = statusMeta[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-[11px] leading-none text-ink-muted',
        className,
      )}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  )
}

export function StatusDot({ status, className }: { status: Status; className?: string }) {
  const meta = statusMeta[status]
  return (
    <span
      className={cn(
        'relative inline-flex h-3 w-3 items-center justify-center rounded-full',
        meta.chip.split(' ').filter((c) => c.startsWith('bg-')).join(' '),
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
    </span>
  )
}

export function SlaBadge({
  value,
  state,
  className,
}: {
  value: string
  state: SlaTarget['state']
  className?: string
}) {
  const styles = {
    breached: 'bg-danger-soft text-danger',
    at_risk: 'bg-p2-soft text-p2',
    ok: 'bg-surface-pill text-ink-muted',
    paused: 'bg-sla-paused-soft text-sla-paused',
  }[state]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
        styles,
        className,
      )}
    >
      {state === 'breached' ? <Cross /> : null}
      {state === 'paused' ? <PauseGlyph /> : null}
      {value}
    </span>
  )
}

/** A paused clock can only ever be *depicted* here — there is nothing counting. */
function PauseGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
      <path d="M4 2.5v7M8 2.5v7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Cross() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden>
      <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

/** Masked content block standing in for redacted titles in the mock list. */
export function Redacted({ width = 120 }: { width?: number }) {
  return (
    <span
      className="inline-block h-3 rounded-[3px] bg-surface-raised align-middle"
      style={{ width }}
      aria-label="redacted"
    />
  )
}
