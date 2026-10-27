import { CheckCircle2, X } from 'lucide-react'
import type { Ticket } from '@/data/types'
import type { SessionAction, TicketSession } from '@/state/types'
import type { NextActionDescriptor } from '@/state/selectors'
import {
  cohortView,
  expectationFor,
  nextAction,
  slaChanges,
  slaFor,
  workflowsThatRan,
} from '@/state/selectors'
import { roleFor, type ViewerRole } from '@/state/viewer'
import { Button, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { SlackIcon } from '@/components/ui/SlackIcon'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { ConfirmPanel, HoldPanel, VerificationPanel } from './panels'
import { SlaReview } from './SlaReview'
import { ResolveForm, ResolutionSummary } from './ResolveForm'

/* ---------------- pure view ---------------- */

/**
 * The one deliberately loud surface on the page. Exactly one of these, always
 * directly under the summary — the contrast *is* the hierarchy lever, so a
 * second accent-bordered card anywhere on this page would kill it.
 *
 * The plan rides inside it as `plan`, under a divider: the step in hand and
 * the path it belongs to are one object, and splitting them into two cards
 * made the page ask twice for the same attention.
 */
export function NextActionCard({
  descriptor,
  children,
  onAct,
  resolved = false,
  quiet = false,
  plan,
}: {
  descriptor: NextActionDescriptor
  children?: React.ReactNode
  onAct?: (action: SessionAction) => void
  resolved?: boolean
  /**
   * Nothing is asked of the viewer. Used by the requester's portal, where the
   * accent has to mean "you need to act" and so cannot be the resting state.
   */
  quiet?: boolean
  /** The whole path, rendered below the divider in the same window. */
  plan?: React.ReactNode
}) {
  const { eyebrow, title, detail, primary, secondary, busy } = descriptor
  return (
    <section
      aria-label="Next action"
      className={cn(
        // `shrink-0` because `overflow-hidden` (which clips the plan half to the
        // rounded corners) also zeroes this flex item's automatic min-height.
        'flex shrink-0 flex-col overflow-hidden rounded-xl border',
        resolved ? 'border-step-done/40' : quiet ? 'border-line-subtle' : 'border-accent/40',
      )}
    >
      <div
        className={cn(
          'flex flex-col gap-3 p-5',
          resolved ? 'bg-step-done-soft/30' : quiet ? 'bg-surface-raised/25' : 'bg-accent-soft/40',
        )}
      >
        <span className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-wide text-ink-muted">
          {resolved ? <CheckCircle2 className="h-3.5 w-3.5 text-step-done" strokeWidth={2} /> : null}
          {eyebrow}
        </span>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-[19px] font-semibold leading-snug text-ink">{title}</h2>
          {/* No reading-column cap in here: the window sets the measure, and a
              paragraph stopping short of its own card just looks unfinished. */}
          {detail ? <p className="text-[14px] leading-relaxed text-ink-muted">{detail}</p> : null}
        </div>

        {children}

        {primary || secondary || busy ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {busy ? (
              <span className="inline-flex items-center gap-2 text-[13px] text-step-running">
                <Spinner />
                Working…
              </span>
            ) : null}
            {primary ? (
              <Button
                variant="primary"
                disabled={primary.disabled}
                onClick={() => onAct?.(primary.action)}
              >
                {primary.label}
              </Button>
            ) : null}
            {secondary ? (
              <Button variant="ghost" onClick={() => onAct?.(secondary.action)}>
                {secondary.label}
              </Button>
            ) : null}
            {primary?.disabled && primary.disabledHint ? (
              <span className="text-[12px] text-ink-muted">{primary.disabledHint}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {plan ? (
        <div
          className={cn(
            'border-t bg-canvas p-5',
            resolved ? 'border-step-done/30' : 'border-accent/25',
          )}
        >
          {plan}
        </div>
      ) : null}
    </section>
  )
}

/* ---------------- container ---------------- */

export function NextActionRegion({
  ticket,
  session,
  dispatch,
  role = roleFor(ticket),
  plan,
}: {
  ticket: Ticket
  session: TicketSession
  dispatch: (action: SessionAction) => void
  role?: ViewerRole
  /** The resolution plan, folded into the same window under a divider. */
  plan?: React.ReactNode
}) {
  const descriptor = nextAction(ticket, session, role)
  const view = cohortView(ticket)

  if (session.resolution) {
    return (
      <NextActionCard descriptor={descriptor} resolved plan={plan}>
        <ResolutionSummary
          resolution={session.resolution}
          cohortSize={view?.size}
          notYetAffected={view?.cohort?.notYetAffected}
        />
      </NextActionCard>
    )
  }

  if (session.resolveOpen) {
    return (
      <NextActionCard descriptor={descriptor} plan={plan}>
        <ResolveForm
          ticket={ticket}
          expectation={expectationFor(ticket, session)}
          draft={session.draft}
          likelyCauseId={ticket.suggestion?.likelyCauseId}
          ranWorkflowIds={workflowsThatRan(ticket, session)}
          onPatch={(patch) => dispatch({ type: 'RESOLVE_DRAFT', patch })}
          onSubmit={() => dispatch({ type: 'RESOLVE' })}
          onCancel={() => dispatch({ type: 'CANCEL_RESOLVE' })}
        />
      </NextActionCard>
    )
  }

  return (
    <NextActionCard descriptor={descriptor} onAct={dispatch} plan={plan}>
      {session.slaSent ? (
        <SlaSentNote
          to={session.slaSent.to}
          targets={session.slaSent.targets}
          onDismiss={() => dispatch({ type: 'DISMISS_SLA_SENT' })}
        />
      ) : null}
      <Panel ticket={ticket} session={session} descriptor={descriptor} dispatch={dispatch} />
    </NextActionCard>
  )
}

/** Confirms the accepted targets reached the requester, right where Start was pressed. */
function SlaSentNote({
  to,
  targets,
  onDismiss,
}: {
  to: string
  targets: string
  onDismiss: () => void
}) {
  return (
    <Note tone="ok" icon={<SlackIcon className="h-3.5 w-3.5" />} className="[&>span:last-child]:flex-1">
      <span className="flex items-start gap-3">
        <span className="flex-1">
          SLA sent to {to} in Slack — {targets}.
        </span>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          className={cn('-m-0.5 rounded p-0.5 opacity-70 transition-opacity hover:opacity-100', focusRing)}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </span>
    </Note>
  )
}

/** The extra surface a state needs, folded into the same card. */
function Panel({
  ticket,
  session,
  descriptor,
  dispatch,
}: {
  ticket: Ticket
  session: TicketSession
  descriptor: NextActionDescriptor
  dispatch: (action: SessionAction) => void
}) {
  const step = descriptor.stepId
    ? ticket.suggestion?.steps.find((s) => s.id === descriptor.stepId)
    : undefined

  switch (descriptor.panel) {
    case 'confirm':
      return step ? <ConfirmPanel step={step} /> : null
    case 'verify':
      return step?.verification ? <VerificationPanel check={step.verification} /> : null
    case 'sla':
      return ticket.slaPolicy ? (
        <SlaReview
          policy={ticket.slaPolicy}
          rows={slaFor(ticket, session)}
          draft={session.slaDraft}
          changes={slaChanges(ticket, session)}
          onAct={dispatch}
        />
      ) : null
    case 'hold':
      return session.hold ? (
        <HoldPanel spec={session.hold.spec} nudgesSent={session.hold.nudgesSent} />
      ) : null
    default:
      return null
  }
}
