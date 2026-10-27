import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Workflow as WorkflowIcon } from 'lucide-react'
import type { SuggestionChip, Ticket } from '@/data/types'
import { getCause } from '@/data/resolutions'
import { useSession } from '@/state/SessionProvider'
import { cohortView } from '@/state/selectors'
import { roleFor } from '@/state/viewer'
import { Note } from '@/components/ui/Note'
import { CompactTicketHeader, TicketHeader } from './TicketHeader'
import { SummaryBlock } from './SummaryBlock'
import { NextActionRegion } from './NextActionRegion'
import { ResolutionPlanView, planRows } from './ResolutionPlan'
import { ActivitySection } from './ActivitySection'

/**
 * Composition order matters more than any single component here. The summary
 * sits directly under the h1 and the next-action region under that: you read
 * what happened before you are told what to do about it, and both sit below
 * the ticket key because you need to know *which* ticket first.
 *
 * The plan is not a sibling of the action card — it is handed to it, and
 * renders inside the same window below a divider. The composer and the log
 * are likewise one Activity block: what you write lands directly above where
 * it will appear. Context (SLA, workflow, volume, Slack) lives in the rail.
 */
export function TicketDetail({
  ticket,
  onOpenCohort,
}: {
  ticket: Ticket
  onOpenCohort?: () => void
}) {
  const [session, dispatch] = useSession(ticket)
  const [explaining, setExplaining] = useState(false)
  const role = roleFor(ticket)

  const started = session.status !== 'open'

  // The compact header pins once the full one (title + meta pills) has
  // scrolled entirely out of the detail scroller. The observer's default root
  // is the viewport, but intersection is clipped by the scroller's overflow,
  // so "out of the scroller" reads as not intersecting.
  const headerRef = useRef<HTMLDivElement>(null)
  const [headerHidden, setHeaderHidden] = useState(false)
  useEffect(() => {
    const node = headerRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setHeaderHidden(!entry.isIntersecting))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const view = cohortView(ticket)
  const cause = ticket.suggestion?.likelyCauseId
    ? getCause(ticket.suggestion.likelyCauseId)
    : undefined

  function onChip(chip: SuggestionChip) {
    switch (chip.act) {
      case 'load_draft':
        dispatch({ type: 'LOAD_DRAFT', stepId: chip.stepId })
        break
      case 'open_cohort':
        onOpenCohort?.()
        break
      case 'explain':
        setExplaining((open) => !open)
        break
      default:
        break
    }
  }

  // The step in hand and the path it sits in are one window, divided — so
  // the plan is handed to the next-action region rather than rendered beside
  // it. The summary moves above both: you read what happened before you are
  // told what to do about it.
  const plan = ticket.suggestion ? (
    <div className="flex flex-col gap-3">
      <ResolutionPlanView
        suggestion={ticket.suggestion}
        rows={planRows(ticket, session)}
        started={started}
        embedded
        editing={session.planEditing}
        onRun={(stepId) => dispatch({ type: 'RUN_STEP', stepId })}
        onRequestConfirm={(stepId) => dispatch({ type: 'APPROVE_STEP', stepId })}
        onMarkDone={(stepId) => dispatch({ type: 'MARK_STEP_DONE', stepId })}
        onStartVerification={(checkId) => dispatch({ type: 'START_VERIFICATION', checkId })}
        onChip={onChip}
        onToggleEdit={
          session.status === 'resolved' ? undefined : () => dispatch({ type: 'TOGGLE_PLAN_EDIT' })
        }
        onSkip={(stepId) => dispatch({ type: 'SKIP_STEP', stepId })}
        onRestore={(stepId) => dispatch({ type: 'RESTORE_STEP', stepId })}
        onRequireApproval={(stepId, value) =>
          dispatch({ type: 'SET_REQUIRE_APPROVAL', stepId, value })
        }
        onDraftChange={(stepId, patch) => dispatch({ type: 'EDIT_STEP_DRAFT', stepId, patch })}
        onResetDraft={(stepId) => dispatch({ type: 'RESET_STEP_DRAFT', stepId })}
        onPostDraft={(stepId) => dispatch({ type: 'POST_STEP_DRAFT', stepId })}
      />
      {explaining ? (
        <Note tone="muted">
          {view?.cohort?.cause ?? 'The agent matched this to previously resolved tickets.'}{' '}
          {cause ? `The most likely cause here is "${cause.label}" — ${cause.detail}` : null}{' '}
          Step 1 is a read-only check, so the diagnosis is confirmed before anything changes.
        </Note>
      ) : null}
    </div>
  ) : null

  return (
    <article className="flex min-w-0 flex-1 flex-col gap-7 py-6 pl-8 pr-6">
      <CompactTicketHeader
        ticket={ticket}
        status={session.status}
        visible={headerHidden}
        onTitleClick={() =>
          headerRef.current?.closest('article')?.scrollIntoView({ behavior: 'smooth' })
        }
      />

      <div ref={headerRef}>
        <TicketHeader ticket={ticket} status={session.status} />
      </div>

      <SummaryBlock ticket={ticket} />

      {session.driver && session.status !== 'resolved' ? (
        <Note tone="muted" icon={<WorkflowIcon className="h-3.5 w-3.5" strokeWidth={1.75} />}>
          {session.driver.kind === 'run' ? (
            <>
              Driven by{' '}
              <Link to={`/workflows/runs/${session.driver.id}`} className="text-ink underline">
                {session.driver.label}
              </Link>{' '}
              — the steps below advance on their own. Gates were approved once for the batch.
            </>
          ) : (
            <>
              Running unattended under the saved workflow <span className="text-ink">{session.driver.label}</span>.
            </>
          )}
        </Note>
      ) : null}

      <NextActionRegion
        ticket={ticket}
        session={session}
        dispatch={dispatch}
        role={role}
        plan={plan}
      />

      <ActivitySection ticket={ticket} session={session} dispatch={dispatch} />

      {/* Clearance so the floating chat dock never covers the last event */}
      <div className="h-24 shrink-0" aria-hidden />
    </article>
  )
}
