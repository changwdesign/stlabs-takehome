import type { StepDraft, Ticket } from '@/data/types'
import type { PhaseKey, StepDraftState, StepRunState, TicketSession } from './types'

function phaseFor(ticket: Ticket): PhaseKey {
  switch (ticket.status) {
    case 'open':
      return 'unstarted'
    case 'in_progress':
      return 'acting'
    case 'on_hold':
      return 'on_hold'
    default:
      return 'resolved'
  }
}

export function draftFrom(draft: StepDraft): StepDraftState {
  return { body: draft.body, attachments: draft.attachments ?? [], edited: false }
}

/**
 * A session is seeded from the fixture the first time a ticket is opened and
 * is never reset by navigation — a run started on tkt-1 survives a trip to
 * tkt-4 and back. Reload resets; this is in-memory only.
 */
export function seedSession(ticket: Ticket): TicketSession {
  const steps: Record<string, StepRunState> = {}
  const stepDrafts: Record<string, StepDraftState> = {}
  for (const step of ticket.suggestion?.steps ?? []) {
    steps[step.id] = 'pending'
    if (step.draft) stepDrafts[step.id] = draftFrom(step.draft)
  }

  // Targets start on the fixture's own row: nothing reads as overridden until
  // somebody moves it.
  const slaTargets: Record<string, string> = {}
  for (const target of ticket.sla) {
    if (target.target) slaTargets[target.label] = target.target
  }

  return {
    status: ticket.status,
    phase: phaseFor(ticket),
    steps,
    appended: [],
    composer: { mode: 'public', body: '', fromAgent: false },
    hold: ticket.hold && ticket.status === 'on_hold' ? { spec: ticket.hold, nudgesSent: 0 } : undefined,
    verify: undefined,
    resolveOpen: false,
    slaTargets,
    slaDraft: { targets: slaTargets, reason: null },
    slaReviewOpen: false,
    planEditing: false,
    requireApproval: {},
    draft: {
      causeId: ticket.suggestion?.likelyCauseId ?? null,
      workflowIds: [],
      note: '',
      notifyCohort: Boolean(ticket.cohortId),
    },
    resolution: undefined,
    bulkUnlocked: false,
    stepDrafts,
    confirming: undefined,
    preApproved: {},
    attempts: {},
    slack: [],
    seq: 0,
  }
}
