import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ChevronDown, X } from 'lucide-react'
import type { Candidate, Ticket } from '@/data/types'
import { getTicket } from '@/data/tickets'
import { getCohort } from '@/data/cohorts'
import { getCause } from '@/data/resolutions'
import { patternForSource } from '@/data/patterns'
import { useLiveStatus, useRuns, useSession } from '@/state/SessionProvider'
import { candidatesFor, isSelected, nextRunId, runForSource, workflowDraftOf } from '@/state/runs'
import { Button, IconButton, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { cn } from '@/lib/cn'
import { CandidateRow } from './CandidateRow'
import { PatternAudit } from './PatternAudit'
import { WorkflowProvenance } from './WorkflowProvenance'

/**
 * Stage 1 of bulk — select, in context. The rail's cohort list grows over the
 * detail column so Grant picks from the list he was already reading. This is
 * the repo's first overlay and it is deliberately minimal: no portal, no
 * focus trap. Escape and a click outside both close it.
 *
 * Everything from confirmation onward happens on the run page — a run
 * outlives Grant's attention on this one ticket.
 */
export function CohortPanel({
  source,
  onClose,
  onSelectTicket,
  onReply,
}: {
  source: Ticket
  onClose: () => void
  onSelectTicket: (id: string) => void
  /** Open an excluded ticket with its alternative reply loaded. */
  onReply: (ticketId: string, body: string) => void
}) {
  const navigate = useNavigate()
  const [state, dispatchRun] = useRuns()
  const [session] = useSession(source)
  const liveStatus = useLiveStatus()
  const [showNotIncluded, setShowNotIncluded] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const pattern = patternForSource(source.id)
  const cohort = source.cohortId ? getCohort(source.cohortId) : undefined
  if (!pattern || !cohort) return null

  const groups = candidatesFor(pattern)
  const existing = runForSource(state, source.id)
  const selected = groups.ready.filter((c) => isSelected(state, pattern.id, c))
  const resolution = session.resolution
  const draft = workflowDraftOf(state, pattern.id)
  const cause = getCause(resolution?.causeId ?? pattern.causeId)

  function reviewAndRun() {
    if (!pattern) return
    if (existing) {
      navigate(`/workflows/runs/${existing.id}`)
      return
    }
    const runId = nextRunId(state)
    dispatchRun({ type: 'CREATE_RUN', runId, patternId: pattern.id })
    navigate(`/workflows/runs/${runId}`)
  }

  const row = (candidate: Candidate) => {
    const ticket = getTicket(candidate.ticketId)
    if (!ticket) return null
    const exclusion = pattern.exclusions[ticket.id]
    return (
      <CandidateRow
        key={ticket.id}
        ticket={ticket}
        candidate={candidate}
        status={liveStatus(ticket)}
        checked={isSelected(state, pattern.id, candidate)}
        onToggle={(value) =>
          dispatchRun({ type: 'TOGGLE_CANDIDATE', patternId: pattern.id, ticketId: ticket.id, value })
        }
        onOpen={() => onSelectTicket(ticket.id)}
        takeoverRequested={Boolean(state.takeovers[ticket.id])}
        onRequestTakeover={() => dispatchRun({ type: 'REQUEST_TAKEOVER', ticketId: ticket.id })}
        onReply={exclusion?.replyBody ? () => onReply(ticket.id, exclusion.replyBody as string) : undefined}
      />
    )
  }

  return (
    <>
      {/* Click-outside target. Dims the detail without hiding it. */}
      <div className="absolute inset-0 z-20 bg-canvas/60" onClick={onClose} aria-hidden />

      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Apply this resolution to the cohort"
        className="absolute inset-y-0 right-0 z-30 flex w-[1040px] max-w-full flex-col border-l border-line bg-canvas shadow-2xl outline-none"
      >
        <header className="flex items-start gap-3 border-b border-line-subtle px-6 py-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[12px] font-medium uppercase tracking-wide text-ink-muted">
              {cohort.label}
            </span>
            <h2 className="text-[19px] font-semibold leading-snug text-ink">
              Run your fix as a workflow across the cohort
            </h2>
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </header>

        {/* Two columns, two jobs. Left: *what* will run — the workflow, on
            the rail's surface. Right: *where* it runs — the tickets, on the
            canvas, with the room. They scroll independently so reviewing
            the eighth ticket never scrolls the workflow out of view. */}
        <div className="flex min-h-0 flex-1">
          <aside
            aria-label="The workflow"
            className="scrollbar-thin flex w-[400px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-line-subtle bg-surface-rail px-5 py-5"
          >
            <ColumnHeading step={1} title="Check the workflow" />
            {/* Provenance only — the name and steps are the card below. */}
            <WorkflowProvenance
              className="-mt-2"
              sourceKey={source.key}
              resolution={resolution}
              causeLabel={cause?.label}
            />

            <PatternAudit
              pattern={pattern}
              steps={source.suggestion?.steps ?? []}
              draft={draft}
              locked={Boolean(existing)}
              edits={{
                onRename: (name) => dispatchRun({ type: 'RENAME_WORKFLOW', patternId: pattern.id, name }),
                onDrop: (stepId, value) =>
                  dispatchRun({ type: 'DROP_WORKFLOW_STEP', patternId: pattern.id, stepId, value }),
                onRequireApproval: (stepId, value) =>
                  dispatchRun({ type: 'REQUIRE_WORKFLOW_APPROVAL', patternId: pattern.id, stepId, value }),
                onAddInstruction: (text) =>
                  dispatchRun({ type: 'ADD_WORKFLOW_INSTRUCTION', patternId: pattern.id, text }),
                onRemoveInstruction: (id) =>
                  dispatchRun({ type: 'REMOVE_WORKFLOW_INSTRUCTION', patternId: pattern.id, id }),
              }}
            />
          </aside>

          <section aria-label="Tickets to review" className="scrollbar-thin flex min-w-0 flex-1 flex-col overflow-y-auto bg-canvas">
            <div className="flex flex-col gap-1 px-6 pb-3 pt-5">
              <ColumnHeading step={2} title="Pick the tickets" />
              <p className="text-[13px] leading-snug text-ink-muted">
                Matched on: {pattern.matchCriteria.join(' · ')}. Click a row to include or leave
                it out.
              </p>
            </div>

            <TicketGroup
              title="Ready to run"
              count={groups.ready.length}
              hint={`pre-checked at ${cohort.threshold.toFixed(2)} or above`}
              action={
                existing ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      const all = selected.length < groups.ready.length
                      for (const c of groups.ready) {
                        dispatchRun({ type: 'TOGGLE_CANDIDATE', patternId: pattern.id, ticketId: c.ticketId, value: all })
                      }
                    }}
                    className={cn('text-[12px] text-ink-muted hover:text-ink', focusRing)}
                  >
                    {selected.length < groups.ready.length ? 'Select all' : 'Clear'}
                  </button>
                )
              }
            >
              {groups.ready.map(row)}
            </TicketGroup>

            {groups.owner.length + groups.excluded.length ? (
              <TicketGroup
                title="Needs a decision"
                count={groups.owner.length + groups.excluded.length}
                hint="won’t run — each has another way forward"
              >
                {groups.owner.map(row)}
                {groups.excluded.map(row)}
              </TicketGroup>
            ) : null}

            {groups.notIncluded.length ? (
              <TicketGroup
                title="Not included"
                count={groups.notIncluded.length}
                hint={`below ${cohort.listFloor.toFixed(2)} or a different cause`}
                collapsed={!showNotIncluded}
                onToggle={() => setShowNotIncluded((open) => !open)}
              >
                {groups.notIncluded.map(row)}
              </TicketGroup>
            ) : null}
            <div className="h-6 shrink-0" aria-hidden />
          </section>
        </div>

        <SelectionSummaryBar
          selected={selected.length}
          owner={groups.owner.length}
          excluded={groups.excluded.length + groups.notIncluded.length}
          existingRunId={existing?.id}
          onReview={reviewAndRun}
        />
      </div>
    </>
  )
}

function ColumnHeading({ step, title }: { step: number; title: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-raised text-[11px] text-ink-muted">
        {step}
      </span>
      {title}
    </h3>
  )
}

/**
 * A titled run of ticket rows. The heading sticks while its rows scroll, so
 * the verdict a row sits under is always on screen.
 */
function TicketGroup({
  title,
  count,
  hint,
  action,
  collapsed = false,
  onToggle,
  children,
}: {
  title: string
  count: number
  hint?: string
  action?: React.ReactNode
  collapsed?: boolean
  onToggle?: () => void
  children: React.ReactNode
}) {
  const label = (
    <>
      {onToggle ? (
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', collapsed && '-rotate-90')} />
      ) : null}
      <span className="font-medium text-ink">{title}</span>
      <span className="text-ink-muted">{count}</span>
      {hint ? <span className="truncate text-ink-faint">· {hint}</span> : null}
    </>
  )
  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-y border-line-subtle bg-surface-list px-6 py-2 text-[12px]">
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!collapsed}
            className={cn('flex min-w-0 flex-1 items-center gap-2 text-left', focusRing)}
          >
            {label}
          </button>
        ) : (
          <span className="flex min-w-0 flex-1 items-center gap-2">{label}</span>
        )}
        {action}
      </div>
      {collapsed ? null : <ul className="flex flex-col divide-y divide-line-subtle">{children}</ul>}
    </div>
  )
}

/** Live counts and the one way forward. */
export function SelectionSummaryBar({
  selected,
  owner,
  excluded,
  existingRunId,
  onReview,
}: {
  selected: number
  owner: number
  excluded: number
  existingRunId?: string
  onReview: () => void
}) {
  return (
    <footer className="flex flex-col gap-3 border-t border-line-subtle bg-canvas px-6 py-4">
      {existingRunId ? (
        <Note tone="muted">
          {existingRunId} already exists for this resolution. Changes here won’t alter it.
        </Note>
      ) : null}
      <div className="flex items-center gap-4">
        <p className="flex-1 text-[13px] text-ink-muted">
          <span className="font-semibold text-ink">{selected} selected</span>
          {owner ? ` · ${owner} owned by someone else` : ''}
          {excluded ? ` · ${excluded} not included` : ''}
        </p>
        <Button
          variant="primary"
          disabled={selected === 0 && !existingRunId}
          icon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />}
          onClick={onReview}
        >
          {existingRunId ? `Open ${existingRunId}` : 'Review & run'}
        </Button>
      </div>
      {!existingRunId ? (
        <span className="text-[12px] text-ink-faint">
          Nothing runs yet. The next screen is a dry run with every message you would send.
        </span>
      ) : null}
    </footer>
  )
}
