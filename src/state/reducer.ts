import type { ActivityEvent, SuggestionStep, Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import { getWorkflow } from '@/data/workflows'
import { getCause } from '@/data/resolutions'
import { draftFrom, seedSession } from './seed'
import {
  automationFor,
  expectationFor,
  isBlocked,
  isSettled,
  slaChanges,
  slaFor,
  workflowsThatRan,
} from './selectors'
import type { PhaseKey, SessionAction, StepRunState, TicketSession } from './types'

const txt = (value: string) => ({ kind: 'text' as const, value })

function stepsOf(ticket: Ticket): SuggestionStep[] {
  return ticket.suggestion?.steps ?? []
}

function findStep(ticket: Ticket, stepId: string): SuggestionStep | undefined {
  return stepsOf(ticket).find((step) => step.id === stepId)
}

/** Prepend a generated event. Fixture activity is never mutated. */
function append(
  session: TicketSession,
  event: Omit<ActivityEvent, 'id' | 'time'> & { time?: string },
): TicketSession {
  const seq = session.seq + 1
  return {
    ...session,
    seq,
    appended: [{ id: `live-${seq}`, time: 'just now', ...event }, ...session.appended],
  }
}

/** Add a message to the ticket's Slack thread, where it has one. */
function mirror(
  session: TicketSession,
  ticket: Ticket,
  authorId: string,
  body: string,
): TicketSession {
  if (!ticket.slack || !body.trim()) return session
  return {
    ...session,
    slack: [
      ...session.slack,
      { id: `slack-${session.seq}-${session.slack.length}`, authorId, time: 'just now', body, fromPortal: true },
    ],
  }
}

function setStep(
  session: TicketSession,
  stepId: string,
  state: StepRunState,
): TicketSession {
  return { ...session, steps: { ...session.steps, [stepId]: state } }
}

/** Diagnosing until something has landed, then acting. */
function advancePhase(session: TicketSession): TicketSession {
  if (session.status !== 'in_progress') return session
  const settled = Object.values(session.steps).some((s) => s === 'done' || s === 'skipped')
  const phase: PhaseKey = settled ? 'acting' : 'diagnosing'
  return phase === session.phase ? session : { ...session, phase }
}

/** Mark a step settled and post its receipt, if it authored one. */
function settleStep(
  session: TicketSession,
  ticket: Ticket,
  step: SuggestionStep,
  state: StepRunState = 'done',
): TicketSession {
  let next = setStep(session, step.id, state)
  if (state === 'done' && step.outcome) {
    const actorId =
      step.actor === 'agent' ? 'agent' : step.actor === 'requester' ? ticket.requesterId : ticket.assigneeId
    next = append(next, {
      actorId,
      ...step.outcome.activity,
      detail: step.outcome.body,
    })
  }
  return advancePhase(next)
}

/**
 * Commit the open SLA review. A change without a reason is refused here, the
 * same rule the Start button's disabled state renders — one source of truth
 * for "you cannot quietly re-cut a commitment".
 */
function commitSla(session: TicketSession, ticket: Ticket): TicketSession | undefined {
  const changes = slaChanges(ticket, session)
  if (changes.length === 0) return { ...session, slaReviewOpen: false }
  const reason = session.slaDraft.reason
  if (!reason) return undefined

  const next: TicketSession = {
    ...session,
    slaTargets: { ...session.slaTargets, ...session.slaDraft.targets },
    slaReviewOpen: false,
  }
  return append(next, {
    actorId: ticket.assigneeId,
    verb: changes.length > 1 ? 'changed the SLA targets —' : 'changed the SLA target —',
    object: changes.map((change) => `${change.slaLabel} ${change.from} → ${change.to}`).join(', '),
    trailing: `· ${reason}`,
  })
}

/**
 * Pure. The ticket is passed in rather than stored because every piece of
 * plan metadata — actors, dependencies, receipts, drafts — lives in the
 * fixture; only run state lives here.
 */
export function sessionReducer(
  session: TicketSession,
  action: SessionAction,
  ticket: Ticket,
): TicketSession {
  const next = reduce(session, action, ticket)
  return next === session
    ? session
    : openResolveOnFinish(session, finishRun(startAutoSteps(next, ticket), ticket), ticket)
}

function allSettled(session: TicketSession, ticket: Ticket): boolean {
  const steps = stepsOf(ticket)
  return steps.length > 0 && steps.every((step) => isSettled(session, step.id))
}

/**
 * The last step is the verification, so once it settles the ticket is fixed
 * in fact — the capture opens on its own rather than waiting behind a
 * "Resolve" click. Only on the transition: Cancel closes it and it stays shut.
 */
function openResolveOnFinish(
  before: TicketSession,
  after: TicketSession,
  ticket: Ticket,
): TicketSession {
  if (after.resolution || after.resolveOpen || after.status !== 'in_progress') return after
  if (allSettled(before, ticket) || !allSettled(after, ticket)) return after
  return reduce(after, { type: 'OPEN_RESOLVE' }, ticket)
}

/**
 * A ticket a run is driving closes itself once every step has settled —
 * verification included, so nothing reaches Resolved unverified. The cause is
 * the pattern's, carried on the ticket's own suggestion.
 */
function finishRun(session: TicketSession, ticket: Ticket): TicketSession {
  if (!session.driver || session.status !== 'in_progress') return session
  const steps = stepsOf(ticket)
  if (steps.length === 0 || !steps.every((step) => isSettled(session, step.id))) return session
  const resolved = reduce(
    { ...session, draft: { ...session.draft, workflowIds: workflowsThatRan(ticket, session), notifyCohort: false } },
    { type: 'RESOLVE' },
    ticket,
  )
  return append(resolved, {
    actorId: 'agent',
    verb: 'closed this out as part of',
    object: session.driver.label,
    trailing: '— verified before resolving',
  })
}

/**
 * Approving the plan at Start is approving its Auto grants, so an Auto step
 * begins the moment its dependencies settle — nobody should have to click
 * Run on work they already said the agent could do unattended. Steps that
 * need approval wait; the card asks for it directly.
 *
 * Automatic verification is the same kind of work: watching for a sign-in
 * asks nothing of anyone, so it starts as soon as the message that prompts
 * the sign-in has gone out.
 */
function startAutoSteps(session: TicketSession, ticket: Ticket): TicketSession {
  if (session.status !== 'in_progress') return session
  let next = session
  for (const step of stepsOf(ticket)) {
    if (next.status !== 'in_progress') break
    if (next.steps[step.id] !== 'pending' || isBlocked(step, next)) continue
    // A failed step waits for a Retry; re-running it unasked would loop.
    if (next.failed?.stepId === step.id) continue

    // The agent's check already showed this one is unnecessary here.
    if (step.notNeeded) {
      next = append(setStep(next, step.id, 'skipped'), {
        actorId: 'agent',
        verb: 'skipped',
        object: step.label,
        trailing: `— ${step.notNeeded}`,
      })
      next = advancePhase(next)
      continue
    }

    const check = step.verification
    if (check?.mode === 'automatic' && next.verify?.checkId !== check.id) {
      next = { ...next, verify: { checkId: check.id, state: 'watching' } }
      continue
    }
    // Driven by a run, a check that can't be automated asks straight away:
    // the batch confirm already agreed to it.
    if (check?.mode === 'requester' && next.driver && check.fallback) {
      next = reduce(next, { type: 'HOLD', spec: check.fallback.hold }, ticket)
      continue
    }

    if (step.actor !== 'agent') continue
    const kind = automationFor(step, next).kind
    if (kind === 'auto' || (kind === 'confirm' && next.preApproved[step.id])) {
      next = setStep(next, step.id, 'running')
    }
  }
  return next
}

function reduce(session: TicketSession, action: SessionAction, ticket: Ticket): TicketSession {
  switch (action.type) {
    case 'START': {
      if (session.status !== 'open') return session
      // Accepting the ticket and accepting its targets are one action: the
      // review that was on screen commits with the start, or nothing starts.
      const committed = commitSla(session, ticket)
      if (!committed) return session
      let next = append(
        { ...committed, status: 'in_progress', phase: 'diagnosing' },
        { actorId: ticket.assigneeId, verb: 'started work', portal: { verb: 'started work on this' } },
      )

      // The accepted targets go to the requester straight away, so they hear
      // what to expect from the same action that commits to it.
      const requester = getUser(ticket.requesterId)
      const targets = slaFor(ticket, next)
        .filter((row) => row.target)
        .map((row) => `${row.label.toLowerCase()} within ${row.target}`)
        .join(', ')
      if (targets) {
        const message = `Grant Fuhr has picked this up. You can expect ${targets}.`
        next = mirror(next, ticket, 'agent', message)
        next = append(
          { ...next, slaSent: { to: requester.name, targets } },
          {
            actorId: 'agent',
            verb: 'sent the SLA to',
            object: requester.name,
            trailing: `in the Slack thread — ${targets}`,
            action: { label: 'View in Slack', icon: 'slack' },
            portal: { verb: 'replied', detail: [txt(message)] },
          },
        )
      }

      // Auto steps start from sessionReducer's pass, like every later unblock.
      return next
    }

    case 'DISMISS_SLA_SENT':
      return session.slaSent ? { ...session, slaSent: undefined } : session

    case 'RUN_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step) return session
      if (session.steps[step.id] !== 'pending') return session
      if (isBlocked(step, session)) return session
      return setStep(session, step.id, 'running')
    }

    case 'REQUEST_CONFIRM': {
      const step = findStep(ticket, action.stepId)
      if (!step || session.steps[step.id] !== 'pending') return session
      if (isBlocked(step, session)) return session
      return { ...setStep(session, step.id, 'awaiting_confirm'), confirming: step.id }
    }

    // One click from pending to running: the card already shows what the
    // step changes, so a separate "review" stop before the approval is noise.
    case 'APPROVE_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step || isBlocked(step, session)) return session
      const current = session.steps[step.id]
      if (current !== 'pending' && current !== 'awaiting_confirm') return session
      return append(
        { ...setStep(session, step.id, 'running'), confirming: undefined },
        { actorId: ticket.assigneeId, verb: 'approved', object: step.label },
      )
    }

    case 'CANCEL_CONFIRM': {
      if (!session.confirming) return session
      return { ...setStep(session, session.confirming, 'pending'), confirming: undefined }
    }

    case 'CONFIRM_STEP': {
      if (session.steps[action.stepId] !== 'awaiting_confirm') return session
      return { ...setStep(session, action.stepId, 'running'), confirming: undefined }
    }

    /**
     * Fired by the Provider's timer. A no-op unless the step is still
     * `running`, so a timeout that outlived its step can't advance anything.
     */
    case 'COMPLETE_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step || session.steps[step.id] !== 'running') return session

      const attempt = (session.attempts[step.id] ?? 0) + 1
      const counted = { ...session, attempts: { ...session.attempts, [step.id]: attempt } }
      if (step.fault && attempt <= step.fault.attempts) {
        // Back to pending, with the error on record. Nothing retries itself.
        return append(
          {
            ...setStep(counted, step.id, 'pending'),
            failed: { stepId: step.id, label: step.fault.label, detail: step.fault.detail },
          },
          {
            actorId: 'agent',
            verb: 'could not complete',
            object: step.label,
            trailing: `— ${step.fault.label.toLowerCase()}${attempt > 1 ? ` (attempt ${attempt})` : ''}`,
          },
        )
      }

      if (step.draft && counted.preApproved[step.id]) {
        // Read and approved at preflight, so it goes out as written.
        const draft = counted.stepDrafts[step.id]
        const posted = append(mirror(counted, ticket, 'agent', draft?.body ?? ''), {
          actorId: 'agent',
          verb: 'replied publicly',
          trailing: `— mirrored to the Slack thread · approved at ${counted.driver?.label ?? 'preflight'}`,
          detail: draft ? [txt(draft.body)] : undefined,
          action: { label: 'View in Slack', icon: 'slack' },
          portal: { verb: 'replied', detail: draft ? [txt(draft.body)] : undefined },
        })
        return advancePhase(setStep(posted, step.id, 'done'))
      }

      if (step.draft) {
        // Drafted, not sent: the message opens on the step itself for review,
        // and the step closes when Grant posts it from there.
        const receipted = step.outcome
          ? append(counted, { actorId: 'agent', ...step.outcome.activity })
          : counted
        return advancePhase(setStep(receipted, step.id, 'awaiting_confirm'))
      }

      return settleStep(counted, ticket, step)
    }

    case 'RETRY_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step || session.failed?.stepId !== step.id) return session
      if (session.steps[step.id] !== 'pending' || isBlocked(step, session)) return session
      return append(
        { ...setStep(session, step.id, 'running'), failed: undefined },
        { actorId: ticket.assigneeId, verb: 'retried', object: step.label },
      )
    }

    case 'BULK_START': {
      if (session.status !== 'open' && session.status !== 'on_hold') return session
      if (session.driver) return session
      // The batch confirm covered every gate in the plan, so record that here
      // rather than asking again on each ticket.
      // Except steps the proposed workflow pulled back: those wait for an
      // approval per ticket, which is the point of pulling them back.
      const pulledBack = new Set(action.requireApproval ?? [])
      const dropped = new Set(action.drop ?? [])
      const preApproved: Record<string, boolean> = {}
      const requireApproval = { ...session.requireApproval }
      const steps = { ...session.steps }
      for (const step of stepsOf(ticket)) {
        if (dropped.has(step.id) && steps[step.id] === 'pending') {
          steps[step.id] = 'skipped'
          continue
        }
        if (pulledBack.has(step.id) && step.automation.kind !== 'manual') {
          requireApproval[step.id] = true
          continue
        }
        if (step.automation.kind === 'confirm' || step.draft) preApproved[step.id] = true
      }
      let started = append(
        {
          ...session,
          status: 'in_progress',
          phase: 'diagnosing',
          hold: undefined,
          driver: action.driver,
          preApproved,
          requireApproval,
          steps,
        },
        {
          actorId: action.by,
          verb: session.status === 'on_hold' ? 'resumed this in' : 'started work in',
          object: action.driver.label,
          trailing:
            action.driver.kind === 'run'
              ? '— gates approved once for the batch'
              : '— running unattended under a saved workflow',
          portal: { verb: session.status === 'on_hold' ? 'picked this back up' : 'started work on this' },
        },
      )
      for (const text of action.instructions ?? []) {
        started = append(started, {
          actorId: 'agent',
          verb: 'is following an instruction from',
          object: getUser(action.by).name,
          detail: [txt(text)],
        })
      }
      return started
    }

    case 'HAND_BACK': {
      if (!session.driver) return session
      return append(
        { ...session, driver: undefined, preApproved: {} },
        {
          actorId: ticket.assigneeId,
          verb: 'took this back from',
          object: session.driver.label,
          trailing: '— continuing one at a time',
        },
      )
    }

    case 'COMPOSER_PREFILL':
      return { ...session, composer: { mode: action.mode, body: action.body, fromAgent: true } }

    case 'LOG':
      return append(session, action.event)

    case 'MARK_STEP_DONE': {
      const step = findStep(ticket, action.stepId)
      if (!step) return session
      const current = session.steps[step.id]
      if (current === 'done' || current === 'running') return session
      if (isBlocked(step, session)) return session
      return settleStep(session, ticket, step)
    }

    case 'SKIP_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step || session.steps[step.id] === 'done') return session
      return advancePhase(
        append(setStep(session, step.id, 'skipped'), {
          actorId: ticket.assigneeId,
          verb: 'skipped step',
          object: step.label,
        }),
      )
    }

    case 'RESTORE_STEP': {
      const step = findStep(ticket, action.stepId)
      if (!step || session.steps[step.id] !== 'skipped') return session
      return advancePhase(
        append(setStep(session, step.id, 'pending'), {
          actorId: ticket.assigneeId,
          verb: 'put the step back —',
          object: step.label,
        }),
      )
    }

    case 'TOGGLE_PLAN_EDIT':
      if (session.status === 'resolved') return session
      return { ...session, planEditing: !session.planEditing }

    /**
     * Revoking a grant is a decision about the agent, so it is logged like
     * one. Only meaningful before the step has run.
     */
    case 'SET_REQUIRE_APPROVAL': {
      const step = findStep(ticket, action.stepId)
      if (!step || step.automation.kind !== 'auto') return session
      if (session.steps[step.id] !== 'pending') return session
      if (Boolean(session.requireApproval[step.id]) === action.value) return session
      const next: TicketSession = {
        ...session,
        requireApproval: { ...session.requireApproval, [step.id]: action.value },
      }
      return append(next, {
        actorId: ticket.assigneeId,
        verb: action.value ? 'required approval on' : 'returned to the agent',
        object: step.label,
        trailing: action.value ? '— the agent will stop before running it' : '— it runs unattended again',
      })
    }

    case 'RUN_WORKFLOW': {
      const workflow = getWorkflow(action.workflowId)
      if (!workflow) return session
      return append(session, {
        actorId: 'agent',
        verb: 'ran workflow',
        object: workflow.name,
      })
    }

    case 'COMPOSER_MODE':
      return { ...session, composer: { ...session.composer, mode: action.mode } }

    case 'COMPOSER_BODY':
      // Any human keystroke drops the "drafted by the agent" attribution.
      return { ...session, composer: { ...session.composer, body: action.body, fromAgent: false } }

    case 'LOAD_DRAFT': {
      const step = findStep(ticket, action.stepId)
      if (!step?.draft) return session
      return {
        ...session,
        composer: { mode: step.draft.mode, body: step.draft.body, fromAgent: true },
      }
    }

    case 'POST_UPDATE': {
      const { mode, body, fromAgent } = session.composer
      if (!body.trim()) return session

      const verb =
        mode === 'public'
          ? 'replied publicly'
          : mode === 'internal'
            ? 'added an internal note'
            : 'sent a secure item'

      let next = append(mode === 'public' ? mirror(session, ticket, ticket.assigneeId, body) : session, {
        actorId: ticket.assigneeId,
        verb,
        trailing: mode === 'public' ? '— mirrored to the Slack thread' : undefined,
        detail: [txt(body)],
        action: mode === 'public' ? { label: 'View in Slack', icon: 'slack' } : undefined,
        portal: mode === 'public' ? { verb: 'replied', detail: [txt(body)] } : undefined,
      })

      if (fromAgent) {
        next = append(next, { actorId: 'agent', verb: 'draft sent as written', trailing: 'by Grant Fuhr' })
      }

      return { ...next, composer: { mode, body: '', fromAgent: false } }
    }

    // Typed straight into the thread from the rail: it is a public message,
    // so it lands on the record like any other public reply.
    case 'SLACK_REPLY': {
      const body = action.body.trim()
      if (!ticket.slack || !body) return session
      return append(mirror(session, ticket, ticket.assigneeId, body), {
        actorId: ticket.assigneeId,
        verb: 'replied in the Slack thread',
        detail: [txt(body)],
        action: { label: 'View in Slack', icon: 'slack' },
        portal: { verb: 'replied', detail: [txt(body)] },
      })
    }

    // From the portal. A reply is what a hold on the requester was waiting
    // for, so it lifts that hold — unless the hold clears on a check, where
    // only the check (or "Yes, it works", which is RESUME) settles it.
    case 'REQUESTER_REPLY': {
      const body = action.body.trim()
      if (!body) return session
      const answers =
        session.status === 'on_hold' &&
        session.hold?.spec.reason === 'awaiting_requester' &&
        !session.hold.spec.check
      let next = append(mirror(session, ticket, ticket.requesterId, body), {
        actorId: ticket.requesterId,
        verb: 'replied from the portal',
        trailing: answers && session.hold?.spec.pausesSla ? '— resolution SLA resumed' : undefined,
        detail: [txt(body)],
        portal: { verb: 'wrote', detail: [txt(body)] },
      })
      if (answers) next = { ...next, status: 'in_progress', phase: 'acting', hold: undefined }
      return next
    }

    case 'EDIT_STEP_DRAFT': {
      const current = session.stepDrafts[action.stepId]
      if (!current || session.steps[action.stepId] === 'done') return session
      return {
        ...session,
        stepDrafts: {
          ...session.stepDrafts,
          [action.stepId]: { ...current, ...action.patch, edited: true },
        },
      }
    }

    case 'RESET_STEP_DRAFT': {
      const step = findStep(ticket, action.stepId)
      if (!step?.draft || session.steps[step.id] === 'done') return session
      return { ...session, stepDrafts: { ...session.stepDrafts, [step.id]: draftFrom(step.draft) } }
    }

    // A drafted step is only finished once the message actually goes out.
    case 'POST_STEP_DRAFT': {
      const step = findStep(ticket, action.stepId)
      const draft = session.stepDrafts[action.stepId]
      if (!step || !draft || session.steps[step.id] !== 'awaiting_confirm') return session
      if (!draft.body.trim()) return session

      const files = draft.attachments.map((file) => file.name).join(', ')
      let next = append(mirror(session, ticket, ticket.assigneeId, draft.body), {
        actorId: ticket.assigneeId,
        verb: 'replied publicly',
        trailing: `— mirrored to the Slack thread${files ? ` · attached ${files}` : ''}`,
        detail: [txt(draft.body)],
        action: { label: 'View in Slack', icon: 'slack' },
        portal: { verb: 'replied', detail: [txt(draft.body)] },
      })
      next = append(next, {
        actorId: 'agent',
        verb: draft.edited ? 'draft sent with edits' : 'draft sent as written',
        trailing: `by ${getUser(ticket.assigneeId).name}`,
      })
      // Not settleStep: the "drafted" receipt already landed when the agent
      // finished, and posting it twice would read as two drafts.
      return advancePhase(setStep(next, step.id, 'done'))
    }

    case 'HOLD': {
      return append(
        {
          ...session,
          status: 'on_hold',
          phase: 'on_hold',
          hold: { spec: action.spec, nudgesSent: 0 },
          verify: undefined,
        },
        {
          actorId: ticket.assigneeId,
          verb: 'put this on hold —',
          object: action.spec.label,
          trailing: action.spec.pausesSla ? '· resolution SLA paused' : undefined,
          portal: { verb: 'put this on hold —', object: action.spec.ask?.title ?? action.spec.label },
        },
      )
    }

    case 'SEND_NUDGE': {
      if (!session.hold) return session
      const who = getUser(ticket.requesterId)
      const nudge = `Hi ${who.name.split(' ')[0]} — just checking in on this one. Reply here whenever you get a chance.`
      const nudged = mirror(session, ticket, 'agent', nudge)
      return append(
        { ...nudged, hold: { ...session.hold, nudgesSent: session.hold.nudgesSent + 1 } },
        {
          actorId: 'agent',
          verb: 'nudged',
          object: who.name,
          trailing: 'in the Slack thread',
          portal: { verb: 'sent a reminder', detail: [txt(nudge)] },
        },
      )
    }

    case 'RESUME': {
      if (session.status !== 'on_hold') return session
      const checkId = session.hold?.spec.check
      let next: TicketSession = {
        ...session,
        status: 'in_progress',
        phase: 'acting',
        hold: undefined,
        verify: checkId ? { checkId, state: 'passed' } : session.verify,
      }
      next = append(next, {
        actorId: ticket.requesterId,
        verb: 'confirmed',
        object: 'the CLI signs in',
        trailing: '— resolution SLA resumed',
        portal: { verb: 'confirmed', object: 'the CLI signs in' },
      })
      const owning = checkId
        ? stepsOf(ticket).find((step) => step.verification?.id === checkId)
        : undefined
      return owning ? advancePhase(setStep(next, owning.id, 'done')) : advancePhase(next)
    }

    case 'START_VERIFICATION': {
      const owning = stepsOf(ticket).find((step) => step.verification?.id === action.checkId)
      if (!owning || session.steps[owning.id] === 'done') return session
      // Nothing to watch: asking the requester *is* the check, and waiting on
      // them is a hold, not a spinner.
      const check = owning.verification
      if (check?.mode === 'requester' && check.fallback) {
        return reduce(session, { type: 'HOLD', spec: check.fallback.hold }, ticket)
      }
      return { ...session, verify: { checkId: action.checkId, state: 'watching' } }
    }

    /** No-op unless still watching — same stale-timer guard as COMPLETE_STEP. */
    case 'VERIFICATION_PASSED': {
      if (session.verify?.checkId !== action.checkId) return session
      if (session.verify.state !== 'watching') return session
      const owning = stepsOf(ticket).find((step) => step.verification?.id === action.checkId)
      const next: TicketSession = {
        ...session,
        verify: { checkId: action.checkId, state: 'passed' },
      }
      return owning ? settleStep(next, ticket, owning) : next
    }

    case 'SET_SLA_TARGET': {
      if (!ticket.sla.some((target) => target.label === action.slaLabel)) return session
      const targets = { ...session.slaDraft.targets, [action.slaLabel]: action.target }
      const draft = { ...session.slaDraft, targets }
      // Reverting every change drops the reason with it — a stale "why" on an
      // unchanged target would be worse than none.
      const reverted = slaChanges(ticket, { ...session, slaDraft: draft }).length === 0
      return { ...session, slaDraft: reverted ? { targets, reason: null } : draft }
    }

    case 'SET_SLA_REASON':
      return { ...session, slaDraft: { ...session.slaDraft, reason: action.reason } }

    case 'OPEN_SLA_REVIEW':
      if (session.status === 'resolved') return session
      return {
        ...session,
        slaReviewOpen: true,
        slaDraft: { targets: session.slaTargets, reason: null },
      }

    case 'CANCEL_SLA_REVIEW':
      return {
        ...session,
        slaReviewOpen: false,
        slaDraft: { targets: session.slaTargets, reason: null },
      }

    case 'COMMIT_SLA':
      return commitSla(session, ticket) ?? session

    case 'OPEN_RESOLVE': {
      return {
        ...session,
        resolveOpen: true,
        draft: {
          ...session.draft,
          // The workflows that actually ran, pre-checked.
          workflowIds: workflowsThatRan(ticket, session),
        },
      }
    }

    case 'CANCEL_RESOLVE':
      return { ...session, resolveOpen: false }

    case 'RESOLVE_DRAFT':
      return { ...session, draft: { ...session.draft, ...action.patch } }

    case 'RESOLVE': {
      const { draft } = session
      if (!draft.causeId) return session
      const cause = getCause(draft.causeId)
      // Scored against the target actually in force, not the fixture's row.
      const expected = expectationFor(ticket, session)
      let next: TicketSession = {
        ...session,
        status: 'resolved',
        phase: 'resolved',
        resolveOpen: false,
        bulkUnlocked: true,
        resolution: {
          causeId: draft.causeId,
          causeLabel: cause?.label ?? draft.causeId,
          workflowIds: draft.workflowIds,
          note: draft.note,
          notifyCohort: draft.notifyCohort,
          timeToResolve: expected?.timeToResolve ?? '—',
          target: expected?.target ?? '—',
          withinTarget: expected?.withinTarget ?? false,
        },
      }
      next = append(next, {
        actorId: ticket.assigneeId,
        verb: 'resolved this ticket —',
        object: cause?.label ?? 'cause captured',
        portal: { verb: 'resolved this —', object: cause?.label ?? 'fixed' },
        trailing: expected ? `· ${expected.timeToResolve} against a ${expected.target} target` : undefined,
      })
      if (draft.notifyCohort) {
        next = append(next, {
          actorId: 'agent',
          verb: 'queued a pre-emptive notice for',
          object: 'the not-yet-affected population',
        })
      }
      return next
    }

    case 'RESET':
      return seedSession(ticket)

    default:
      return session
  }
}
