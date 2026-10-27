import { Link } from 'react-router-dom'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { workflows } from '@/data/workflows'
import { runHistory } from '@/data/runs'
import { getPattern } from '@/data/patterns'
import { getUser } from '@/data/users'
import { useRuns } from '@/state/SessionProvider'
import { runItems, runStatus } from '@/state/runs'
import { PageShell } from '@/components/layout/PageShell'
import { Note } from '@/components/ui/Note'
import { focusRing } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { RunStatusBadge } from '@/components/run/RunBadges'

/**
 * Where a bulk fix lives once it outgrows the ticket it started on. Runs
 * first — they are what Grant comes back to — and the catalogue as a stub:
 * browsing it is out of scope, but a workflow saved from a resolution has to
 * be visibly different from a stock one.
 */
export function WorkflowsPage() {
  const [state] = useRuns()
  const live = [...state.runOrder].reverse().map((id) => state.runs[id])
  const categories = [...new Set(workflows.map((w) => w.category))]

  return (
    <PageShell>
      <h1 className="text-[26px] font-semibold tracking-[-0.01em] text-ink">Workflows</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] text-ink-muted">Runs</h2>
        <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
          {live.map((run) => {
            const items = runItems(run, state)
            const resolved = items.filter((row) => row.state === 'resolved').length
            return (
              <li key={run.id}>
                <Link
                  to={`/workflows/runs/${run.id}`}
                  className={cn('flex items-center gap-4 px-4 py-3 hover:bg-surface-raised/30', focusRing)}
                >
                  <span className="w-12 font-mono text-[12px] text-ink-muted">{run.id}</span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] font-medium text-ink">
                      {getPattern(run.patternId)?.name}
                    </span>
                    <span className="text-[12px] text-ink-muted">
                      {getUser(run.createdBy).name} · {run.createdAtLabel} · {resolved} of {items.length} resolved
                    </span>
                  </span>
                  <RunStatusBadge status={runStatus(run, items)} />
                </Link>
              </li>
            )
          })}
          {runHistory.map((entry) => (
            <li key={entry.id} className="flex items-center gap-4 px-4 py-3">
              <span className="w-12 font-mono text-[12px] text-ink-faint">{entry.id}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] text-ink-muted">{entry.name}</span>
                <span className="text-[12px] text-ink-faint">
                  {getUser(entry.createdBy).name} · {entry.createdAtLabel} · {entry.resolved} of {entry.total} resolved
                </span>
              </span>
              <RunStatusBadge status={entry.status} />
            </li>
          ))}
        </ul>
        {live.length === 0 ? (
          <Note tone="muted">
            Runs start from a resolved ticket’s cohort — resolve TKT-2583, then apply it from the
            rail, or{' '}
            <Link to="/bulk" className="text-ink underline">
              skip straight to the bulk flow
            </Link>
            .
          </Note>
        ) : null}
      </section>

      {state.savedWorkflows.length ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-[13px] text-ink-muted">Saved from resolutions</h2>
          <ul className="flex flex-col gap-2">
            {state.savedWorkflows.map((workflow) => (
              <li key={workflow.id} className="flex items-center gap-3 rounded-xl border border-line px-4 py-3">
                <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.75} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[13px] font-medium text-ink">{workflow.name}</span>
                  <span className="text-[12px] text-ink-muted">
                    Saved by {getUser(workflow.createdBy ?? 'grant').name} · runs on new matches without asking
                  </span>
                </span>
                {state.arrived.length ? (
                  <Link
                    to={`/t/${state.arrived[0]}`}
                    className={cn('inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink', focusRing)}
                  >
                    Last match
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] text-ink-muted">Catalogue</h2>
        <p className="text-[13px] text-ink-muted">
          {workflows.length} stock workflows across {categories.join(', ')}. Browsing the catalogue
          is out of scope here — the agent surfaces the relevant ones on each ticket.
        </p>
      </section>
    </PageShell>
  )
}
