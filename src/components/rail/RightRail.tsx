import { Hourglass, Waypoints, Workflow as WorkflowIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { Ticket, WorkflowRun } from '@/data/types'
import { patternForSource, patterns } from '@/data/patterns'
import { useRuns } from '@/state/SessionProvider'
import { runForSource, runItems, runStatus, type RootState } from '@/state/runs'
import { runStatusMeta } from '@/components/run/RunBadges'
import { getUser } from '@/data/users'
import { getTicket } from '@/data/tickets'
import type { SessionAction, TicketSession } from '@/state/types'
import { cohortView, slaChanges, slaFor, slaReviewBlocked } from '@/state/selectors'
import { Button } from '@/components/ui/Button'
import { PriorityBadge, SlaBadge } from '@/components/ui/badges'
import { CollapsibleSection } from '@/components/ui/Collapsible'
import { Note } from '@/components/ui/Note'
import { SlaReview } from '@/components/ticket/SlaReview'
import {
  BuiltWorkflowCard,
  WorkflowSection,
  builtWorkflowFor,
} from '@/components/ticket/WorkflowSection'
import { SlackIcon } from '@/components/ui/SlackIcon'
import { CohortSectionView } from './CohortSection'
import { SlackSection } from './SlackSection'
import { FollowersSection, RailPanel } from './RailPanel'

/**
 * The rail holds context so the main column can hold the work. Order is
 * SLA → Workflow → Related → Slack → Followers. The clock comes first because
 * it bounds everything else. Workflow sits right under it as the catalogue
 * search. Related tickets and the Slack thread are collapsed by default —
 * their headers ("8 tickets", the channel) carry the signal. Once a
 * resolution is saved as a workflow, its card ("Apply to N tickets", or
 * "Running in run-1" on the rest of the cohort) is pinned under the Related
 * tickets header, visible even while the list is collapsed: it acts on
 * exactly those tickets. Requester details moved to the header pill's
 * hover card, next to the other ticket fields.
 *
 * The rail is sticky inside the detail scroller and scrolls on its own when
 * it is taller than the viewport (Workflow plus an expanded cohort can be).
 */
export function RightRail({
  ticket,
  session,
  dispatch,
  cohortOpen,
  onCohortOpenChange,
  onSelectTicket,
  onApplyBulk,
  bulkOpen,
}: {
  ticket: Ticket
  session: TicketSession
  dispatch: (action: SessionAction) => void
  cohortOpen?: boolean
  onCohortOpenChange?: (open: boolean) => void
  onSelectTicket?: (id: string) => void
  /** Opens the cohort panel over the detail column. */
  onApplyBulk?: () => void
  bulkOpen?: boolean
}) {
  const navigate = useNavigate()
  const [root] = useRuns()
  const existingRun = runForSource(root, ticket.id)
  const runSummary = existingRun ? summarizeRun(existingRun, root) : undefined
  const followers = ticket.followerIds.map(getUser)
  const view = cohortView(ticket)
  const sla = slaFor(ticket, session)
  const paused = sla.some((target) => target.state === 'paused')
  const overridden = sla.find((target) => target.overridden)
  // Reviewable here once the ticket is moving. Before that the review lives in
  // the start card, where accepting the ticket accepts the targets.
  const reviewable =
    Boolean(ticket.slaPolicy) && session.status !== 'open' && session.status !== 'resolved'
  // Same condition as the start card's `panel: 'sla'` in selectors.nextAction:
  // while that review is on screen, the rail points to it instead of repeating it.
  const inStartCard = session.phase === 'unstarted' && Boolean(ticket.slaPolicy)

  const pattern = ticket.cohortId ? patterns.find((p) => p.cohortId === ticket.cohortId) : undefined
  const built = builtWorkflowFor(ticket, session, root, {
    onApply: onApplyBulk,
    onOpenRun: (runId) => navigate(`/workflows/runs/${runId}`),
  })

  const otherRelated = view
    ? []
    : ticket.related
        .map((link) => ({ link, other: getTicket(link.ticketId) }))
        .filter((row): row is { link: typeof row.link; other: Ticket } => Boolean(row.other))

  return (
    // 62px is the FilterBar's height: the detail scroller this rail sticks
    // inside fills the rest of the viewport.
    <RailPanel offset={62}>
      <CollapsibleSection
        title="SLA"
        icon={<Hourglass className="h-4 w-4" strokeWidth={1.75} />}
        trailing={inStartCard ? ticket.slaPolicy?.label : undefined}
      >
        <div className="flex flex-col gap-3 pl-6">
          {inStartCard ? (
            <Note tone="muted">
              Under review in the start card — accepting the ticket accepts these targets.
            </Note>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {sla.map((target) => (
                <div key={target.label} className="flex flex-col gap-2">
                  <span className="text-[12px] text-ink-muted">{target.label}</span>
                  <SlaBadge value={target.value} state={target.state} className="self-start" />
                  {target.target ? (
                    <span className="text-[11px] leading-none text-ink-faint">
                      target {target.target}
                      {target.overridden ? (
                        <span className="text-accent"> · policy {target.policyTarget}</span>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
          {paused ? (
            <Note tone="muted">
              Paused while on hold. There is no countdown in this prototype — the pause is
              depicted, not computed.
            </Note>
          ) : null}
          {overridden && !session.slaReviewOpen ? (
            <Note tone="muted">
              {overridden.label} was re-cut from the {ticket.slaPolicy?.label} row. The change
              and its reason are in the activity log.
            </Note>
          ) : null}
          {reviewable ? (
            session.slaReviewOpen && ticket.slaPolicy ? (
              <SlaReview
                policy={ticket.slaPolicy}
                rows={sla}
                draft={session.slaDraft}
                changes={slaChanges(ticket, session)}
                onAct={dispatch}
                footer={
                  <>
                    <Button
                      variant="primary"
                      disabled={slaReviewBlocked(ticket, session)}
                      onClick={() => dispatch({ type: 'COMMIT_SLA' })}
                    >
                      Save targets
                    </Button>
                    <Button onClick={() => dispatch({ type: 'CANCEL_SLA_REVIEW' })}>
                      Cancel
                    </Button>
                  </>
                }
              />
            ) : (
              <Button
                variant="subtle"
                className="self-start"
                onClick={() => dispatch({ type: 'OPEN_SLA_REVIEW' })}
              >
                Review targets
              </Button>
            )
          ) : null}
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Workflow"
        icon={<WorkflowIcon className="h-4 w-4" strokeWidth={1.75} />}
      >
        <div className="pl-6">
          <WorkflowSection
            ticket={ticket}
            heading={false}
            disabled={session.status === 'open'}
            onRun={dispatch}
            showMatches={!pattern}
          />
        </div>
      </CollapsibleSection>

      {view ? (
        <CollapsibleSection
          title="Related tickets"
          icon={<Waypoints className="h-4 w-4" strokeWidth={1.75} />}
          open={cohortOpen}
          onOpenChange={onCohortOpenChange}
          trailing={`${view.size} tickets`}
          pinned={built ? <BuiltWorkflowCard workflow={built} /> : undefined}
        >
          <CohortSectionView
            view={view}
            bulkUnlocked={session.bulkUnlocked}
            bulkAvailable={Boolean(patternForSource(ticket.id))}
            onSelect={onSelectTicket}
            onApply={onApplyBulk}
            applyOpen={bulkOpen}
            run={existingRun && runSummary ? { id: existingRun.id, summary: runSummary } : undefined}
            onOpenRun={() => existingRun && navigate(`/workflows/runs/${existingRun.id}`)}
            actionElsewhere={Boolean(built)}
          />
        </CollapsibleSection>
      ) : (
        <CollapsibleSection
          title="Related tickets"
          icon={<Waypoints className="h-4 w-4" strokeWidth={1.75} />}
          defaultOpen={false}
          trailing={otherRelated.length ? String(otherRelated.length) : undefined}
        >
          <div className="flex flex-col gap-2 pl-6">
            {otherRelated.length === 0 ? (
              <p className="text-[13px] text-ink-muted">No related tickets.</p>
            ) : (
              otherRelated.map(({ link, other }) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => onSelectTicket?.(other.id)}
                  className="flex flex-col gap-0.5 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                      {other.title}
                    </span>
                    <PriorityBadge priority={other.priority} />
                  </span>
                  <span className="text-[12px] text-ink-muted">{link.reason}</span>
                </button>
              ))
            )}
          </div>
        </CollapsibleSection>
      )}

      {ticket.slack ? (
        <CollapsibleSection
          title="Slack thread"
          icon={<SlackIcon className="h-4 w-4" />}
          trailing={ticket.slack.channel}
          defaultOpen={false}
        >
          <SlackSection
            thread={ticket.slack}
            session={session}
            requesterId={ticket.requesterId}
            dispatch={dispatch}
          />
        </CollapsibleSection>
      ) : null}

      <FollowersSection followers={followers} action="Subscribe" />
    </RailPanel>
  )
}

function summarizeRun(run: WorkflowRun, root: RootState): string {
  const items = runItems(run, root)
  const resolved = items.filter((row) => row.state === 'resolved').length
  const status = runStatusMeta[runStatus(run, items)].label
  return `${status} · ${resolved} of ${items.length} resolved.`
}
