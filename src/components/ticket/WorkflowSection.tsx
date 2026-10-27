import { useMemo, useState, type ReactNode } from 'react'
import { ArrowRight, Play, Sparkles, Workflow as WorkflowIcon } from 'lucide-react'
import type { Ticket } from '@/data/types'
import type { SessionAction, TicketSession } from '@/state/types'
import { workflows, getWorkflow } from '@/data/workflows'
import { patterns } from '@/data/patterns'
import { getTicket } from '@/data/tickets'
import { runForSource, type RootState } from '@/state/runs'
import { cohortView } from '@/state/selectors'
import { Button } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { cn } from '@/lib/cn'

/** One look for "a workflow built from a resolution", wherever it shows up. */
export const builtWorkflowTone = 'border-accent/40 bg-accent-soft/30'

export function BuiltWorkflowGlyph({ className }: { className?: string }) {
  return <WorkflowIcon className={cn('h-3.5 w-3.5 text-accent', className)} strokeWidth={1.9} />
}

/** A workflow built from a resolution — the same card on the source ticket and the cohort. */
export interface BuiltWorkflow {
  name: string
  stepCount: number
  /** e.g. "Built from this ticket’s resolution" or "Built from TKT-…". */
  origin: string
  /** e.g. "Running in run-1". */
  status?: string
  /**
   * `primary` marks the page's one primary action — "Apply to N tickets" once
   * the source ticket is resolved, when the action card has none of its own.
   */
  action?: { label: string; onClick: () => void; primary?: boolean }
}

/**
 * The workflow built from the cohort's proven fix, once it exists. The same
 * card on the source ticket (apply it) and the rest of the cohort (it is what
 * runs here), matching the provenance line in the panel and run page.
 */
export function builtWorkflowFor(
  ticket: Ticket,
  session: TicketSession,
  root: RootState,
  { onApply, onOpenRun }: { onApply?: () => void; onOpenRun?: (runId: string) => void },
): BuiltWorkflow | undefined {
  const pattern = ticket.cohortId ? patterns.find((p) => p.cohortId === ticket.cohortId) : undefined
  if (!pattern) return undefined
  const isSource = pattern.sourceTicketId === ticket.id
  const sourceResolved = isSource
    ? Boolean(session.resolution)
    : Boolean(root.sessions[pattern.sourceTicketId]?.resolution)
  if (!sourceResolved) return undefined

  const run = runForSource(root, pattern.sourceTicketId)
  const others = (cohortView(ticket)?.size ?? 1) - 1
  return {
    name: pattern.name,
    stepCount: pattern.steps.length,
    origin: isSource
      ? 'Built from this ticket’s resolution'
      : `Built from ${getTicket(pattern.sourceTicketId)?.key ?? pattern.sourceTicketId}`,
    status: session.driver ? `Running in ${session.driver.label}` : undefined,
    action: run
      ? onOpenRun
        ? { label: `Open ${run.id}`, onClick: () => onOpenRun(run.id) }
        : undefined
      : isSource && onApply
        ? { label: `Apply to ${others} tickets`, onClick: onApply, primary: true }
        : undefined,
  }
}

/**
 * Matches the source design: a "Workflow" heading over the catalogue search,
 * always visible. Below it, only what applies to this ticket — the workflow
 * built from a resolution once one exists, or catalogue matches the agent
 * found. A first-time fix has neither, so the section is just the search.
 */
export function WorkflowSection({
  ticket,
  onRun,
  disabled = false,
  built,
  showMatches = true,
  heading = true,
}: {
  ticket: Ticket
  onRun?: (action: SessionAction) => void
  disabled?: boolean
  built?: BuiltWorkflow
  /** Off for cohort tickets, where the built workflow is the one that applies. */
  showMatches?: boolean
  /** Off in the rail, where the collapsible section's title replaces it. */
  heading?: boolean
}) {
  const [query, setQuery] = useState('')

  const matched = useMemo(
    () =>
      showMatches
        ? (ticket.suggestion?.workflowIds ?? [])
            .map((id) => getWorkflow(id))
            .filter((workflow): workflow is NonNullable<typeof workflow> => Boolean(workflow))
        : [],
    [ticket, showMatches],
  )

  const results = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    return workflows
      .filter((workflow) => workflow.name.toLowerCase().includes(needle))
      .slice(0, 6)
  }, [query])

  return (
    <section className="flex flex-col gap-3">
      {heading ? <h2 className="text-[13px] text-ink-muted">Workflow</h2> : null}

      {/* Regular size: this lives in the 360px rail, where the large field reads as a slab. */}
      <SearchInput
        className="h-8 rounded-lg py-0"
        placeholder="Run a workflow..."
        trailing={`${workflows.length} available`}
        value={query}
        onChange={setQuery}
      />

      {results.length ? (
        <div className="flex flex-col gap-0.5">
          {results.map((workflow) => (
            <button
              key={workflow.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                onRun?.({ type: 'RUN_WORKFLOW', workflowId: workflow.id })
                setQuery('')
              }}
              className="flex items-center justify-between rounded-lg px-3 py-2 text-left text-[13px] text-ink transition-colors hover:bg-surface-raised disabled:pointer-events-none disabled:opacity-40"
            >
              {workflow.name}
              <span className="text-[12px] text-ink-muted">{workflow.category}</span>
            </button>
          ))}
        </div>
      ) : null}

      {built ? <BuiltWorkflowCard workflow={built} /> : null}

      {matched.map((workflow) => (
        <WorkflowRow
          key={workflow.id}
          icon={<Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />}
          title={workflow.name}
          meta={`${workflow.category} · matched by the agent`}
          className="border-line bg-canvas"
          trailing={
            <Button
              variant="subtle"
              disabled={disabled}
              icon={<Play className="h-3 w-3" strokeWidth={2} />}
              onClick={() => onRun?.({ type: 'RUN_WORKFLOW', workflowId: workflow.id })}
            >
              Run
            </Button>
          }
        />
      ))}
    </section>
  )
}

export function BuiltWorkflowCard({ workflow }: { workflow: BuiltWorkflow }) {
  return (
    <WorkflowRow
      icon={<BuiltWorkflowGlyph className="shrink-0" />}
      title={workflow.name}
      meta={[workflow.origin, `${workflow.stepCount} steps`, workflow.status]
        .filter(Boolean)
        .join(' · ')}
      className={builtWorkflowTone}
      trailing={
        workflow.action ? (
          <Button
            variant={workflow.action.primary ? 'primary' : 'subtle'}
            icon={
              workflow.action.primary ? (
                <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
              ) : undefined
            }
            onClick={workflow.action.onClick}
          >
            {workflow.action.label}
          </Button>
        ) : null
      }
    />
  )
}

function WorkflowRow({
  icon,
  title,
  meta,
  trailing,
  className,
}: {
  icon: ReactNode
  title: string
  meta: string
  trailing?: ReactNode
  className?: string
}) {
  return (
    // Stacked rather than one row: at rail width a trailing button squeezes the
    // name to a few characters.
    <div className={cn('flex flex-col gap-2.5 rounded-xl border px-4 py-3', className)}>
      <div className="flex items-start gap-3">
        <span className="mt-[3px] flex shrink-0">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] leading-snug text-ink">{title}</span>
          <span className="block text-[12px] text-ink-muted">{meta}</span>
        </span>
      </div>
      {trailing ? <div className="flex justify-end">{trailing}</div> : null}
    </div>
  )
}
