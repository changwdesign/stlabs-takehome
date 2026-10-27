import type { Automation, ActivityEvent, SlaTarget, SuggestionStep, Ticket } from '@/data/types'
import { withinTarget } from '@/lib/duration'
import { cohortTickets, getTicket } from '@/data/tickets'
import { getCohort } from '@/data/cohorts'
import { getUser } from '@/data/users'
import type { SessionAction, TicketSession } from './types'
import type { ViewerRole } from './viewer'

/* ------------------------------------------------------------------
   Derived step state. Blocked-ness is computed from `dependsOn` every
   time it is asked for, so editing a dependency can never leave a
   stale flag behind in the session.
   ------------------------------------------------------------------ */

export function isSettled(session: TicketSession, stepId: string): boolean {
  const state = session.steps[stepId]
  return state === 'done' || state === 'skipped'
}

export function isBlocked(step: SuggestionStep, session: TicketSession): boolean {
  if (!step.dependsOn?.length) return false
  return step.dependsOn.some((id) => !isSettled(session, id))
}

/** The dependency a blocked step is waiting on, for naming it in the UI. */
export function blockerOf(
  step: SuggestionStep,
  session: TicketSession,
  ticket: Ticket,
): SuggestionStep | undefined {
  const id = step.dependsOn?.find((dep) => !isSettled(session, dep))
  return ticket.suggestion?.steps.find((s) => s.id === id)
}

/**
 * The autonomy actually in force. The fixture's grant is the default; a step
 * Grant pulled back in plan-edit mode runs behind an approval gate instead.
 * Read everywhere the grant is rendered or acted on, so the plan, the card
 * and the button can never disagree about who is allowed to press go.
 */
export function automationFor(step: SuggestionStep, session: TicketSession): Automation {
  if (!session.requireApproval[step.id] || step.automation.kind === 'manual') {
    return step.automation
  }
  return {
    kind: 'confirm',
    because: `its original grant said: ${step.automation.because}`,
  }
}

export function stepIndex(ticket: Ticket, stepId: string): number {
  return (ticket.suggestion?.steps ?? []).findIndex((s) => s.id === stepId)
}

export function planProgress(ticket: Ticket, session: TicketSession) {
  const steps = ticket.suggestion?.steps ?? []
  const done = steps.filter((step) => isSettled(session, step.id)).length
  return { done, total: steps.length, complete: steps.length > 0 && done === steps.length }
}

/** First step that is neither settled nor blocked — the only one actionable. */
export function currentStep(ticket: Ticket, session: TicketSession): SuggestionStep | undefined {
  return (ticket.suggestion?.steps ?? []).find(
    (step) => !isSettled(session, step.id) && !isBlocked(step, session),
  )
}

/** Workflows attached to steps that actually ran — pre-checked at resolve time. */
export function workflowsThatRan(ticket: Ticket, session: TicketSession): string[] {
  return (ticket.suggestion?.steps ?? [])
    .filter((step) => step.workflowId && session.steps[step.id] === 'done')
    .map((step) => step.workflowId as string)
}

/** Session events first — both lists are newest-first. Never mutates the fixture. */
export function activityFor(ticket: Ticket, session: TicketSession): ActivityEvent[] {
  return [...session.appended, ...ticket.activity]
}

/* ------------------------------------------------------------------
   Cohort
   ------------------------------------------------------------------ */

export interface CohortView {
  cohort: ReturnType<typeof getCohort>
  /** Every ticket sharing the cause, this one included. */
  size: number
  /** Related links above the confidence threshold — the bulk candidates. */
  candidates: Array<{ ticket: Ticket; reason: string; confidence: number; inCohort: boolean }>
  /** Listed, explained, below threshold, not counted in the bulk action. */
  nearMisses: Array<{ ticket: Ticket; reason: string; confidence: number; inCohort: boolean }>
}

export function cohortView(ticket: Ticket): CohortView | undefined {
  if (!ticket.cohortId) return undefined
  const cohort = getCohort(ticket.cohortId)
  if (!cohort) return undefined

  const rows = ticket.related
    .map((link) => {
      const other = getTicket(link.ticketId)
      if (!other) return undefined
      return {
        ticket: other,
        reason: link.reason,
        confidence: link.confidence,
        inCohort: other.cohortId === ticket.cohortId,
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))

  return {
    cohort,
    size: cohortTickets(ticket.cohortId).length,
    candidates: rows.filter((row) => row.confidence >= cohort.threshold && row.inCohort),
    nearMisses: rows.filter((row) => row.confidence < cohort.threshold || !row.inCohort),
  }
}

/* ------------------------------------------------------------------
   The single next action.

   One pure function is what enforces *exactly one primary action per
   state*. If a second primary is ever needed the signature makes that
   visible, instead of letting it creep in as JSX.
   ------------------------------------------------------------------ */

export interface NextActionButton {
  label: string
  action: SessionAction
  /** Set when the state needs something filled in first — see `slaReviewBlocked`. */
  disabled?: boolean
  /** Why it is disabled, said out loud rather than left to a greyed button. */
  disabledHint?: string
}

export interface NextActionDescriptor {
  eyebrow: string
  title: string
  detail: string
  primary?: NextActionButton
  secondary?: NextActionButton
  /** Something is in flight: render progress, not a button. */
  busy?: boolean
  /** Extra surface folded into the card, so the loud region stays the only one. */
  panel?: 'confirm' | 'verify' | 'hold' | 'sla'
  /** The step the action refers to, for cross-referencing the plan. */
  stepId?: string
}

const actorPhrase: Record<SuggestionStep['actor'], string> = {
  agent: 'Agent',
  assignee: 'You',
  requester: 'Requester',
  third_party: 'Third party',
}

export function nextAction(
  ticket: Ticket,
  session: TicketSession,
  role: ViewerRole,
): NextActionDescriptor {
  const progress = planProgress(ticket, session)

  // Role-aware by construction: a non-assignee sees the same record and is
  // told who owns it, rather than being handed somebody else's controls.
  if (role !== 'assignee') {
    return {
      eyebrow: role === 'requester' ? 'Your request' : 'Watching',
      title:
        session.status === 'resolved'
          ? 'This has been resolved'
          : `${getUser(ticket.assigneeId).kind === 'agent' ? 'The agent' : getUser(ticket.assigneeId).name} is handling this`,
      detail:
        role === 'requester'
          ? 'You will be told when anything changes. Nothing is needed from you right now.'
          : 'You are following this ticket. Actions belong to the assignee.',
    }
  }

  if (session.resolution) {
    return {
      eyebrow: 'Resolved',
      title: session.resolution.causeLabel,
      detail: `Captured in ${session.resolution.timeToResolve} against a ${session.resolution.target} target.`,
    }
  }

  if (session.resolveOpen) {
    return {
      eyebrow: `All ${progress.total} steps done · verified`,
      title: 'What actually fixed it?',
      detail:
        'The fix is confirmed. Check the cause and close this out — it is what lets the same resolution be offered to the rest of the cohort.',
    }
  }

  if (session.phase === 'unstarted') {
    // The SLA clocks, the plan and the cohort each have their own box on this
    // page, so the card says only what the button will do — not what those
    // boxes already show.
    const reviewable = Boolean(ticket.slaPolicy)
    const blocked = reviewable && slaReviewBlocked(ticket, session)
    const autoSteps = (ticket.suggestion?.steps ?? []).filter(
      (step) => step.actor === 'agent' && automationFor(step, session).kind === 'auto',
    ).length
    const requester = getUser(ticket.requesterId).name.split(' ')[0]
    return {
      eyebrow: 'Unstarted',
      title: reviewable ? 'Review the targets, then start' : 'Review the plan, then start',
      detail: [
        reviewable ? `Starting accepts the targets below and sends them to ${requester} in Slack.` : 'Starting approves the plan below.',
        autoSteps > 0 ? 'Steps marked Auto begin right away.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      primary: {
        label: 'Approve steps and start resolving',
        action: { type: 'START' },
        disabled: blocked,
        disabledHint: blocked ? 'Pick a reason for the target change first.' : undefined,
      },
      panel: reviewable ? 'sla' : undefined,
    }
  }

  if (session.status === 'on_hold' && session.hold) {
    const { spec, nudgesSent } = session.hold
    return {
      eyebrow: 'On hold',
      title: spec.label,
      detail: spec.pausesSla
        ? 'The resolution clock is paused, so the requester’s latency does not score against you.'
        : 'This clock keeps running.',
      primary: { label: 'They confirmed — continue', action: { type: 'RESUME' } },
      secondary:
        nudgesSent < 2 ? { label: `Send a nudge (${2 - nudgesSent} left)`, action: { type: 'SEND_NUDGE' } } : undefined,
      panel: 'hold',
    }
  }

  if (session.verify?.state === 'watching') {
    const step = (ticket.suggestion?.steps ?? []).find(
      (s) => s.verification?.id === session.verify?.checkId,
    )
    const check = step?.verification
    return {
      eyebrow: 'Verifying',
      title: check?.label ?? 'Verifying',
      detail:
        check?.followUp ??
        'Automatic verification is preferred over asking the requester to confirm.',
      busy: true,
      secondary:
        check?.fallback && step
          ? { label: check.fallback.label, action: { type: 'HOLD', spec: check.fallback.hold } }
          : undefined,
      // No verify panel: it would repeat this title and detail word for word.
      stepId: step?.id,
    }
  }

  if (session.failed) {
    const failedStep = (ticket.suggestion?.steps ?? []).find((s) => s.id === session.failed?.stepId)
    const n = failedStep ? stepIndex(ticket, failedStep.id) + 1 : 0
    return {
      eyebrow: `Step ${n} of ${progress.total} · failed`,
      title: session.failed.label,
      detail: session.failed.detail,
      primary: { label: 'Retry', action: { type: 'RETRY_STEP', stepId: session.failed.stepId } },
      secondary: session.driver ? { label: 'Take it out of the run', action: { type: 'HAND_BACK' } } : undefined,
      stepId: session.failed.stepId,
    }
  }

  const step = currentStep(ticket, session)

  if (!step) {
    return {
      eyebrow: 'Ready to resolve',
      title: 'Capture what fixed it',
      detail: `All ${progress.total} steps are done. Capturing the cause is what lets this resolution be offered to the rest of the cohort.`,
      primary: { label: 'Resolve ticket', action: { type: 'OPEN_RESOLVE' } },
    }
  }

  const n = stepIndex(ticket, step.id) + 1
  const state = session.steps[step.id]
  const automation = automationFor(step, session)
  // Pulled back in plan-edit mode: say so, rather than quoting a grant that
  // no longer applies as if it were the reason for the gate.
  const pulledBack = automation.kind === 'confirm' && step.automation.kind === 'auto'
  const because =
    automation.kind === 'manual'
      ? step.label
      : pulledBack
        ? `You asked to approve this one — ${automation.because}`
        : automation.because
  const where = `Step ${n} of ${progress.total} · ${actorPhrase[step.actor]} · ${step.tool.label}`

  if (state === 'running') {
    return {
      eyebrow: where,
      title: step.runLabel ?? `Running ${step.label.toLowerCase()}…`,
      detail: because,
      busy: true,
      stepId: step.id,
    }
  }

  if (state === 'awaiting_confirm' && step.draft) {
    return {
      eyebrow: where,
      title: 'Review the Slack reply',
      detail: `The agent drafted it on step ${n} below. Read it, change the text or attachments, then post — nothing has left the portal yet.`,
      stepId: step.id,
    }
  }

  if (state === 'awaiting_confirm') {
    return {
      eyebrow: where,
      // The blast radius itself belongs to ConfirmPanel below — saying it twice
      // in one card reads as padding and stops being read at all.
      title: `Approve: ${step.label}`,
      detail: 'This one does not run on its own. Read what it changes, then approve it.',
      primary: { label: 'Approve and run', action: { type: 'APPROVE_STEP', stepId: step.id } },
      panel: 'confirm',
      stepId: step.id,
    }
  }

  if (step.verification) {
    return {
      eyebrow: where,
      title: step.verification.mode === 'automatic' ? 'Verify without asking' : 'Ask for confirmation',
      detail: `${step.verification.label}. ${step.verification.followUp}`,
      primary: {
        label: 'Start watching',
        action: { type: 'START_VERIFICATION', checkId: step.verification.id },
      },
      stepId: step.id,
    }
  }

  // The agent is ready and only waiting on Grant, so the ask *is* the approval.
  if (step.actor === 'agent' && automation.kind === 'confirm') {
    return {
      eyebrow: where,
      title: `Approve: ${step.label}`,
      detail: 'The agent is ready to run this and is waiting on your approval.',
      primary: { label: 'Approve and run', action: { type: 'APPROVE_STEP', stepId: step.id } },
      panel: 'confirm',
      stepId: step.id,
    }
  }

  if (step.actor === 'agent') {
    return {
      eyebrow: where,
      title: step.label,
      detail: because,
      primary: { label: `Run step ${n}`, action: { type: 'RUN_STEP', stepId: step.id } },
      stepId: step.id,
    }
  }

  return {
    eyebrow: where,
    title: step.label,
    detail: 'Only a person can do this one — there is no Run button, by design.',
    primary: { label: 'I have done this', action: { type: 'MARK_STEP_DONE', stepId: step.id } },
    secondary: { label: 'Skip it', action: { type: 'SKIP_STEP', stepId: step.id } },
    stepId: step.id,
  }
}

/* ------------------------------------------------------------------
   SLA

   The fixture holds the policy row; the session holds the target in
   force. Everything the UI shows about a clock is derived here, so the
   rail, the start card and the resolve summary can never disagree about
   what this ticket was committed to.
   ------------------------------------------------------------------ */

export interface SlaView extends SlaTarget {
  /** What the policy row says, whether or not the target still matches it. */
  policyTarget?: string
  /** Somebody moved this target off the policy row. */
  overridden: boolean
}

/** SLA rendered through the session: a hold pauses the clock, a review re-cuts the target. */
export function slaFor(ticket: Ticket, session: TicketSession): SlaView[] {
  const paused = Boolean(session.hold?.spec.pausesSla)
  return ticket.sla.map((target) => {
    const committed = session.slaTargets[target.label] ?? target.target
    const policyTarget = ticket.slaPolicy?.reference[target.label] ?? target.target
    return {
      ...target,
      target: committed,
      state:
        paused && target.pausable && target.state !== 'breached' ? 'paused' : target.state,
      policyTarget,
      overridden: Boolean(committed && policyTarget && committed !== policyTarget),
    }
  })
}

export interface SlaChange {
  slaLabel: string
  from: string
  to: string
}

/** What the open review would change if it committed right now. */
export function slaChanges(ticket: Ticket, session: TicketSession): SlaChange[] {
  return ticket.sla
    .map((target) => {
      const from = session.slaTargets[target.label] ?? target.target
      const to = session.slaDraft.targets[target.label] ?? from
      return from && to && from !== to ? { slaLabel: target.label, from, to } : undefined
    })
    .filter((change): change is SlaChange => Boolean(change))
}

/**
 * A change has to say why. Same rule in the reducer and in the disabled
 * state of the button, computed once here so they cannot drift apart.
 */
export function slaReviewBlocked(ticket: Ticket, session: TicketSession): boolean {
  return slaChanges(ticket, session).length > 0 && !session.slaDraft.reason
}

/**
 * Actual-vs-target for the resolve capture. `timeToResolve` is authored —
 * there are no clocks here — but the target it is scored against is whatever
 * is in force, so an override shows up honestly as "over" or "within".
 */
export interface Expectation {
  timeToResolve: string
  target: string
  withinTarget: boolean
  /** Set when the target in force is not the policy row's. */
  policyTarget?: string
}

export function expectationFor(ticket: Ticket, session: TicketSession): Expectation | undefined {
  const expected = ticket.expected
  if (!expected) return undefined
  const row = slaFor(ticket, session).find((target) => target.label === 'Resolution')
  const target = row?.target ?? expected.target
  const computed = withinTarget(expected.timeToResolve, target)
  return {
    timeToResolve: expected.timeToResolve,
    target,
    withinTarget: computed ?? expected.withinTarget,
    policyTarget: row?.overridden ? row.policyTarget : undefined,
  }
}
