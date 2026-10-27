import { AlertTriangle, Check, Circle, Hand, Hourglass, Minus } from 'lucide-react'
import type { RunItemState, RunStatus, StepScaleVerdict } from '@/data/types'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'

/* ---------------------------------------------------------------
   Same rule as badges.tsx: a state is one entry in a map, styled
   from existing step tokens. A run item is the single-ticket step
   machine seen from a distance, so it borrows that palette.
   --------------------------------------------------------------- */

export const itemStateMeta: Record<RunItemState, { label: string; chip: string }> = {
  queued: { label: 'Queued', chip: 'bg-surface-pill text-ink-faint' },
  running: { label: 'Running', chip: 'bg-step-running-soft text-step-running' },
  needs_input: { label: 'Needs you', chip: 'bg-step-confirm-soft text-step-confirm' },
  failed: { label: 'Failed', chip: 'bg-danger-soft text-danger' },
  awaiting_verification: { label: 'Verifying', chip: 'bg-sla-paused-soft text-sla-paused' },
  resolved: { label: 'Resolved', chip: 'bg-step-done-soft text-step-done' },
  skipped: { label: 'Handed back', chip: 'bg-surface-pill text-ink-muted' },
}

function ItemGlyph({ state }: { state: RunItemState }) {
  const cls = 'h-3 w-3'
  switch (state) {
    case 'running':
      return <Spinner className="h-3 w-3" />
    case 'needs_input':
      return <Hand className={cls} strokeWidth={2} />
    case 'failed':
      return <AlertTriangle className={cls} strokeWidth={2} />
    case 'awaiting_verification':
      return <Hourglass className={cls} strokeWidth={2} />
    case 'resolved':
      return <Check className={cls} strokeWidth={2.5} />
    case 'skipped':
      return <Minus className={cls} strokeWidth={2.5} />
    default:
      return <Circle className={cls} strokeWidth={2} />
  }
}

export function RunItemBadge({ state, className }: { state: RunItemState; className?: string }) {
  const meta = itemStateMeta[state]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
        meta.chip,
        className,
      )}
    >
      <ItemGlyph state={state} />
      {meta.label}
    </span>
  )
}

export const runStatusMeta: Record<RunStatus, { label: string; chip: string }> = {
  preflight: { label: 'Preflight', chip: 'bg-step-confirm-soft text-step-confirm' },
  running: { label: 'Running', chip: 'bg-step-running-soft text-step-running' },
  awaiting_verification: { label: 'Verifying', chip: 'bg-sla-paused-soft text-sla-paused' },
  completed: { label: 'Completed', chip: 'bg-step-done-soft text-step-done' },
  completed_with_exceptions: {
    label: 'Completed with exceptions',
    chip: 'bg-status-on-hold-soft text-status-on-hold',
  },
  cancelled: { label: 'Cancelled', chip: 'bg-surface-pill text-ink-muted' },
}

export function RunStatusBadge({ status, className }: { status: RunStatus; className?: string }) {
  const meta = runStatusMeta[status]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-medium leading-none',
        meta.chip,
        className,
      )}
    >
      {status === 'running' ? <Spinner className="h-3 w-3" /> : null}
      {meta.label}
    </span>
  )
}

export const scaleMeta: Record<StepScaleVerdict, { label: string; chip: string }> = {
  auto_at_scale: { label: 'Runs at scale', chip: 'bg-step-done-soft text-step-done' },
  per_ticket_input: { label: 'Needs input per ticket', chip: 'bg-step-confirm-soft text-step-confirm' },
  blocks_bulk: { label: 'Blocks bulk', chip: 'bg-danger-soft text-danger' },
}

export function ScaleBadge({ verdict }: { verdict: StepScaleVerdict }) {
  const meta = scaleMeta[verdict]
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-none',
        meta.chip,
      )}
    >
      {meta.label}
    </span>
  )
}

/** Five dots, one per step — the plan's progress at list density. */
export function StepDots({ states }: { states: Array<'done' | 'skipped' | 'running' | 'pending' | 'awaiting_confirm' | 'failed'> }) {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      {states.map((state, i) => (
        <span
          key={i}
          className={cn(
            'h-1.5 w-4 rounded-full',
            state === 'done' && 'bg-step-done',
            state === 'skipped' && 'bg-step-done/40',
            state === 'running' && 'animate-pulse bg-step-running',
            state === 'awaiting_confirm' && 'bg-step-confirm',
            state === 'failed' && 'bg-danger',
            state === 'pending' && 'bg-surface-raised',
          )}
        />
      ))}
    </span>
  )
}
