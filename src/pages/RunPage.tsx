import { Link, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ChevronRight, Workflow as WorkflowIcon } from 'lucide-react'
import { getTicket, lateTickets } from '@/data/tickets'
import { getPattern } from '@/data/patterns'
import { getCohort } from '@/data/cohorts'
import { getCause } from '@/data/resolutions'
import { getUser } from '@/data/users'
import { useRuns, useTicketDispatch } from '@/state/SessionProvider'
import { runItems, runStatus, sessionOf, workflowDraftOf } from '@/state/runs'
import { PageShell } from '@/components/layout/PageShell'
import { StepProgress } from '@/components/ui/StepProgress'
import { CollapsibleSection } from '@/components/ui/Collapsible'
import { focusRing } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { RunStatusBadge } from '@/components/run/RunBadges'
import { PreflightPanel } from '@/components/run/PreflightPanel'
import { RunProgressList } from '@/components/run/RunProgressList'
import { ExceptionsList, VerificationWatchList } from '@/components/run/ExceptionsList'
import { RunCloseout } from '@/components/run/RunCloseout'
import { WorkflowProvenance } from '@/components/cohort/WorkflowProvenance'
import { PatternAudit } from '@/components/cohort/PatternAudit'

/**
 * Stage 2 of bulk — everything from confirmation onward. A run is
 * long-lived: it executes while requesters verify over hours, so it lives at
 * its own address rather than in a panel anchored to one ticket's rail.
 *
 * The page reads ticket sessions, never a copy of them. Open any ticket in
 * the list mid-run and it shows the same steps advancing.
 */
export function RunPage() {
  const { runId } = useParams()
  const [state, dispatchRun] = useRuns()
  const sendTo = useTicketDispatch()
  const run = runId ? state.runs[runId] : undefined

  if (!run) {
    return (
      <PageShell>
        <Breadcrumb id={runId ?? '—'} />
        <p className="text-[14px] text-ink-muted">
          No run with that id. Runs live in memory and reset on reload.
        </p>
      </PageShell>
    )
  }

  const items = runItems(run, state)
  const status = runStatus(run, items)
  const pattern = getPattern(run.patternId)
  // The workflow as Grant edited it in the cohort panel.
  const draft = workflowDraftOf(state, run.patternId)
  const workflowName = draft.name?.trim() || pattern?.name || run.patternId
  const source = getTicket(run.sourceTicketId)
  const cohort = getCohort(run.cohortId)
  // The cause as captured on the source ticket, not the pattern's generalization.
  const captured = source ? state.sessions[source.id]?.resolution : undefined
  const cause = getCause(captured?.causeId ?? pattern?.causeId ?? '')
  const settled = items.filter((row) => row.state === 'resolved' || row.state === 'skipped').length
  const exceptions = items.filter((row) => row.state === 'failed' || row.state === 'needs_input')
  const verifying = items.filter((row) => row.state === 'awaiting_verification')
  const late = lateTickets.find((ticket) => state.arrived.includes(ticket.id))
  const done = status === 'completed' || status === 'completed_with_exceptions'

  return (
    <PageShell>
      <Breadcrumb id={run.id} />

      {/* Same opening as the cohort panel it came from: the group as an
          eyebrow, the workflow as the title, provenance as one sentence.
          The phase and progress are plain text, not a diagram. */}
      <header className="flex flex-col gap-2">
        {cohort ? (
          <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
            {cohort.label}
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink">
            {workflowName}
          </h1>
          <RunStatusBadge status={status} />
        </div>
        {source ? (
          <WorkflowProvenance
            sourceKey={
              <Link to={`/t/${source.id}`} className={cn('hover:underline', focusRing)}>
                {source.key}
              </Link>
            }
            resolution={captured}
            causeLabel={cause?.label}
          />
        ) : null}
        <p className="text-[13px] text-ink-muted">
          <span className="font-mono">{run.id}</span> · started by {getUser(run.createdBy).name}{' '}
          {run.createdAtLabel} ·{' '}
          <span className="text-ink">
            {run.phase === 'preflight'
              ? `Dry run on ${items.length} tickets`
              : run.phase === 'cancelled'
                ? `Cancelled before ${items.length} tickets ran`
                : done
                  ? `Applied to ${items.length} tickets`
                  : `Running on ${items.length} tickets`}
          </span>
          {pattern ? ` · ${pattern.steps.filter((s) => !draft.dropped[s.stepId]).length} steps` : ''}
        </p>
        {run.phase === 'confirmed' ? (
          <StepProgress done={settled} total={items.length} className="mt-1" />
        ) : null}
      </header>

      {pattern && source ? (
        <WorkflowDetails stepCount={pattern.steps.filter((s) => !draft.dropped[s.stepId]).length}>
          <PatternAudit embedded pattern={pattern} steps={source.suggestion?.steps ?? []} draft={draft} />
        </WorkflowDetails>
      ) : null}

      {run.phase === 'preflight' ? (
        <PreflightPanel
          run={run}
          items={items}
          onConfirm={() => dispatchRun({ type: 'CONFIRM_RUN', runId: run.id })}
          onCancel={() => dispatchRun({ type: 'CANCEL_RUN', runId: run.id })}
        />
      ) : null}

      {run.phase === 'cancelled' ? (
        <p className="text-[14px] text-ink-muted">
          Cancelled at preflight. Nothing ran and no one was messaged.
        </p>
      ) : null}

      {run.phase === 'confirmed' ? (
        <>
          {done && cohort ? (
            <RunCloseout
              run={run}
              items={items}
              notYetAffected={cohort.notYetAffected}
              arrival={late ? { ticket: late, session: sessionOf(state, late) } : undefined}
              onNotify={() => dispatchRun({ type: 'NOTIFY_COHORT', runId: run.id })}
              onSave={() => dispatchRun({ type: 'SAVE_AS_WORKFLOW', runId: run.id })}
            />
          ) : null}

          {exceptions.length ? (
            <ExceptionsList
              items={exceptions}
              onTicket={sendTo}
              onHandBack={(ticketId) => dispatchRun({ type: 'HAND_BACK_ITEM', runId: run.id, ticketId })}
            />
          ) : null}

          {verifying.length ? <VerificationWatchList items={verifying} onTicket={sendTo} /> : null}

          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] text-ink-muted">All tickets in this run</h2>
            <RunProgressList items={items} />
          </section>
        </>
      ) : null}
    </PageShell>
  )
}

/**
 * The workflow this run applies, as it was confirmed: every step, who runs
 * it, its verdict at scale, and any instructions given to the agent. Its own
 * container with the rail's section header, collapsed by default — the run's
 * progress is what this page is for — but one click from the header, so
 * nobody has to go back to the source ticket to see what is being done to
 * every account. Read-only: edits would not reach a run that already exists.
 */
function WorkflowDetails({ stepCount, children }: { stepCount: number; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line-subtle bg-canvas">
      <CollapsibleSection
        title="Workflow"
        icon={<WorkflowIcon className="h-4 w-4" strokeWidth={1.75} />}
        trailing={`${stepCount} steps`}
        defaultOpen={false}
        flush
      >
        {children}
      </CollapsibleSection>
    </div>
  )
}

function Breadcrumb({ id }: { id: string }) {
  return (
    <nav className="flex items-center gap-1.5 text-[13px] text-ink-muted">
      <Link to="/workflows" className={cn('hover:text-ink', focusRing)}>
        Workflows
      </Link>
      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span>Runs</span>
      <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.75} />
      <span className="font-mono text-ink">{id}</span>
    </nav>
  )
}
