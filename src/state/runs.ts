import type {
  Candidate,
  ResolutionPattern,
  RunItemState,
  RunStatus,
  Ticket,
  Workflow,
  WorkflowRun,
  WorkflowRunItem,
} from '@/data/types'
import { getTicket } from '@/data/tickets'
import { getCohort } from '@/data/cohorts'
import { getPattern } from '@/data/patterns'
import { getUser } from '@/data/users'
import { sessionReducer } from './reducer'
import { seedSession } from './seed'
import { automationFor, currentStep, isBlocked, nextAction } from './selectors'
import type { SessionAction, TicketSession } from './types'
import { CURRENT_USER } from './viewer'

/* ------------------------------------------------------------------
   Root state. Ticket sessions and runs live in one reducer because a
   run has no execution state of its own: it hands each ticket a
   BULK_START and from then on *reads* that ticket's session. Item
   state, run status and exceptions are all derived below.
   ------------------------------------------------------------------ */

export interface RootState {
  sessions: Record<string, TicketSession>
  runs: Record<string, WorkflowRun>
  /** Creation order, newest last. */
  runOrder: string[]
  /** Candidate checkboxes per pattern; absent means "use the default". */
  selections: Record<string, Record<string, boolean>>
  /** Tickets Grant has asked another admin to hand over. */
  takeovers: Record<string, true>
  /** Workflows saved from a resolution this session. */
  savedWorkflows: Workflow[]
  /** Late tickets that have been filed. */
  arrived: string[]
  /** Grant's edits to a proposed workflow, keyed by pattern id. */
  workflowDrafts: Record<string, WorkflowDraft>
}

/**
 * The proposed workflow is the agent's suggestion, edited the same way the
 * single-ticket plan is: drop a step, or pull one back behind an approval.
 * Instructions are free text the agent applies on every ticket in the run.
 */
export interface WorkflowDraft {
  name?: string
  dropped: Record<string, true>
  requireApproval: Record<string, true>
  instructions: Array<{ id: string; text: string }>
}

export const emptyWorkflowDraft: WorkflowDraft = { dropped: {}, requireApproval: {}, instructions: [] }

export function workflowDraftOf(state: RootState, patternId: string): WorkflowDraft {
  return state.workflowDrafts[patternId] ?? emptyWorkflowDraft
}

function updateDraft(
  state: RootState,
  patternId: string,
  patch: (draft: WorkflowDraft) => WorkflowDraft,
): RootState {
  return {
    ...state,
    workflowDrafts: { ...state.workflowDrafts, [patternId]: patch(workflowDraftOf(state, patternId)) },
  }
}

function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record }
  delete next[key]
  return next
}

export const initialRoot: RootState = {
  sessions: {},
  runs: {},
  runOrder: [],
  selections: {},
  takeovers: {},
  savedWorkflows: [],
  arrived: [],
  workflowDrafts: {},
}

export type RunAction =
  | { type: 'TOGGLE_CANDIDATE'; patternId: string; ticketId: string; value: boolean }
  | { type: 'REQUEST_TAKEOVER'; ticketId: string }
  | { type: 'CREATE_RUN'; runId: string; patternId: string }
  | { type: 'CONFIRM_RUN'; runId: string }
  | { type: 'CANCEL_RUN'; runId: string }
  /** Fired by the Provider's staggered timer, one per item. */
  | { type: 'START_ITEM'; runId: string; ticketId: string }
  | { type: 'HAND_BACK_ITEM'; runId: string; ticketId: string }
  | { type: 'NOTIFY_COHORT'; runId: string }
  | { type: 'SAVE_AS_WORKFLOW'; runId: string }
  /** A late ticket is filed; the saved workflow picks it up. */
  | { type: 'ARRIVE'; ticketId: string; workflowId: string }
  /**
   * Demo shortcut: play a ticket's single-ticket path through to Resolved in
   * one go, so the bulk flow can be reached without clicking through pass 1.
   */
  | { type: 'FAST_FORWARD_RESOLVE'; ticketId: string }
  /** Demo control: back to a fresh load — every session, run and arrival gone. */
  | { type: 'DEMO_RESET' }
  | { type: 'RENAME_WORKFLOW'; patternId: string; name: string }
  | { type: 'DROP_WORKFLOW_STEP'; patternId: string; stepId: string; value: boolean }
  | { type: 'REQUIRE_WORKFLOW_APPROVAL'; patternId: string; stepId: string; value: boolean }
  | { type: 'ADD_WORKFLOW_INSTRUCTION'; patternId: string; text: string }
  | { type: 'REMOVE_WORKFLOW_INSTRUCTION'; patternId: string; id: string }

export type RootMessage = { ticketId: string; action: SessionAction } | { run: RunAction }

export function sessionOf(state: RootState, ticket: Ticket): TicketSession {
  return state.sessions[ticket.id] ?? seedSession(ticket)
}

/** Apply a ticket action through the one reducer every ticket uses. */
function applyTicket(state: RootState, ticketId: string, action: SessionAction): RootState {
  const ticket = getTicket(ticketId)
  if (!ticket) return state
  const current = sessionOf(state, ticket)
  const next = sessionReducer(current, action, ticket)
  if (next === current && state.sessions[ticketId]) return state
  return { ...state, sessions: { ...state.sessions, [ticketId]: next } }
}

function updateRun(
  state: RootState,
  runId: string,
  patch: (run: WorkflowRun) => WorkflowRun | undefined,
): RootState {
  const run = state.runs[runId]
  if (!run) return state
  const next = patch(run)
  if (!next || next === run) return state
  return { ...state, runs: { ...state.runs, [runId]: next } }
}

function updateItem(
  run: WorkflowRun,
  ticketId: string,
  patch: Partial<WorkflowRunItem>,
): WorkflowRun {
  return {
    ...run,
    items: run.items.map((item) => (item.ticketId === ticketId ? { ...item, ...patch } : item)),
  }
}

export const SAVED_WORKFLOW_ID = 'wf-saved-sso-cli'

export function rootReducer(state: RootState, message: RootMessage): RootState {
  if ('ticketId' in message) return applyTicket(state, message.ticketId, message.action)

  const action = message.run
  switch (action.type) {
    case 'TOGGLE_CANDIDATE':
      return {
        ...state,
        selections: {
          ...state.selections,
          [action.patternId]: {
            ...state.selections[action.patternId],
            [action.ticketId]: action.value,
          },
        },
      }

    // Asking is logged on the ticket being asked about, so Sam sees it there.
    case 'REQUEST_TAKEOVER': {
      if (state.takeovers[action.ticketId]) return state
      const ticket = getTicket(action.ticketId)
      if (!ticket) return state
      const next = { ...state, takeovers: { ...state.takeovers, [action.ticketId]: true as const } }
      return applyTicket(next, action.ticketId, {
        type: 'LOG',
        event: {
          actorId: CURRENT_USER,
          verb: 'asked to take this over from',
          object: getUser(ticket.assigneeId).name,
          trailing: '— to include it in the SSO bulk fix',
        },
      })
    }

    case 'RENAME_WORKFLOW':
      return updateDraft(state, action.patternId, (d) => ({ ...d, name: action.name }))

    case 'DROP_WORKFLOW_STEP':
      return updateDraft(state, action.patternId, (d) => ({
        ...d,
        dropped: action.value ? { ...d.dropped, [action.stepId]: true } : without(d.dropped, action.stepId),
      }))

    case 'REQUIRE_WORKFLOW_APPROVAL':
      return updateDraft(state, action.patternId, (d) => ({
        ...d,
        requireApproval: action.value
          ? { ...d.requireApproval, [action.stepId]: true }
          : without(d.requireApproval, action.stepId),
      }))

    case 'ADD_WORKFLOW_INSTRUCTION': {
      const text = action.text.trim()
      if (!text) return state
      return updateDraft(state, action.patternId, (d) => ({
        ...d,
        instructions: [...d.instructions, { id: `ins-${d.instructions.length + 1}-${Date.now()}`, text }],
      }))
    }

    case 'REMOVE_WORKFLOW_INSTRUCTION':
      return updateDraft(state, action.patternId, (d) => ({
        ...d,
        instructions: d.instructions.filter((i) => i.id !== action.id),
      }))

    case 'CREATE_RUN': {
      const pattern = getPattern(action.patternId)
      if (!pattern || state.runs[action.runId]) return state
      const items = selectedIds(pattern, state).map((ticketId) => ({
        ticketId,
        started: false,
        handedBack: false,
      }))
      if (items.length === 0) return state
      const run: WorkflowRun = {
        id: action.runId,
        patternId: pattern.id,
        sourceTicketId: pattern.sourceTicketId,
        cohortId: pattern.cohortId,
        createdBy: CURRENT_USER,
        createdAtLabel: 'just now',
        phase: 'preflight',
        items,
      }
      return {
        ...state,
        runs: { ...state.runs, [run.id]: run },
        runOrder: [...state.runOrder, run.id],
      }
    }

    case 'CONFIRM_RUN': {
      const run = state.runs[action.runId]
      if (!run || run.phase !== 'preflight') return state
      const next = updateRun(state, run.id, (r) => ({ ...r, phase: 'confirmed' }))
      return applyTicket(next, run.sourceTicketId, {
        type: 'LOG',
        event: {
          actorId: CURRENT_USER,
          verb: 'applied this resolution to',
          object: `${run.items.length} tickets`,
          trailing: `in ${run.id}`,
        },
      })
    }

    case 'CANCEL_RUN':
      return updateRun(state, action.runId, (run) =>
        run.phase === 'preflight' ? { ...run, phase: 'cancelled' } : undefined,
      )

    /** No-op unless the item is still waiting — a stale timer can't start it twice. */
    case 'START_ITEM': {
      const run = state.runs[action.runId]
      const item = run?.items.find((i) => i.ticketId === action.ticketId)
      if (!run || run.phase !== 'confirmed' || !item || item.started || item.handedBack) return state
      const next = updateRun(state, run.id, (r) => updateItem(r, action.ticketId, { started: true }))
      // The workflow as Grant edited it, not as the agent proposed it.
      const draft = workflowDraftOf(state, run.patternId)
      return applyTicket(next, action.ticketId, {
        type: 'BULK_START',
        driver: { kind: 'run', id: run.id, label: run.id },
        by: CURRENT_USER,
        drop: Object.keys(draft.dropped),
        requireApproval: Object.keys(draft.requireApproval),
        instructions: draft.instructions.map((i) => i.text),
      })
    }

    case 'HAND_BACK_ITEM': {
      const run = state.runs[action.runId]
      const item = run?.items.find((i) => i.ticketId === action.ticketId)
      if (!run || !item || item.handedBack) return state
      const next = updateRun(state, run.id, (r) =>
        updateItem(r, action.ticketId, { handedBack: true }),
      )
      return item.started ? applyTicket(next, action.ticketId, { type: 'HAND_BACK' }) : next
    }

    case 'NOTIFY_COHORT': {
      const run = state.runs[action.runId]
      if (!run || run.notifiedCohort) return state
      const cohort = getCohort(run.cohortId)
      const next = updateRun(state, run.id, (r) => ({ ...r, notifiedCohort: true }))
      return applyTicket(next, run.sourceTicketId, {
        type: 'LOG',
        event: {
          actorId: 'agent',
          verb: 'sent the pre-emptive notice to',
          object: `${cohort?.notYetAffected ?? 0} people`,
          trailing: 'who have not filed yet',
        },
      })
    }

    case 'SAVE_AS_WORKFLOW': {
      const run = state.runs[action.runId]
      const pattern = run ? getPattern(run.patternId) : undefined
      if (!run || !pattern || run.savedWorkflowId) return state
      const workflow: Workflow = {
        id: SAVED_WORKFLOW_ID,
        name: workflowDraftOf(state, pattern.id).name?.trim() || pattern.name,
        category: 'Identity',
        createdBy: CURRENT_USER,
        patternId: pattern.id,
      }
      const next: RootState = {
        ...updateRun(state, run.id, (r) => ({ ...r, savedWorkflowId: workflow.id })),
        savedWorkflows: [...state.savedWorkflows.filter((w) => w.id !== workflow.id), workflow],
      }
      return applyTicket(next, run.sourceTicketId, {
        type: 'LOG',
        event: {
          actorId: CURRENT_USER,
          verb: 'saved this resolution as the workflow',
          object: workflow.name,
          trailing: '— new matches run without asking',
        },
      })
    }

    /**
     * The payoff: a new ticket is matched to the saved workflow and run by the
     * agent end to end. It goes through BULK_START like any run item, so the
     * ticket shows the same steps advancing on their own.
     */
    case 'ARRIVE': {
      if (state.arrived.includes(action.ticketId)) return state
      const workflow = state.savedWorkflows.find((w) => w.id === action.workflowId)
      if (!workflow) return state
      let next: RootState = { ...state, arrived: [...state.arrived, action.ticketId] }
      next = applyTicket(next, action.ticketId, {
        type: 'LOG',
        event: {
          actorId: 'agent',
          verb: 'matched this to the saved workflow',
          object: workflow.name,
          trailing: '— 0.95, above the 0.80 threshold',
        },
      })
      return applyTicket(next, action.ticketId, {
        type: 'BULK_START',
        driver: { kind: 'workflow', id: workflow.id, label: workflow.name },
        by: 'agent',
      })
    }

    case 'FAST_FORWARD_RESOLVE':
      return fastForwardResolve(state, action.ticketId)

    case 'DEMO_RESET':
      return initialRoot

    default:
      return state
  }
}

/**
 * Replays what the timers and the primary button would do, one action at a
 * time, until the ticket resolves. Nothing is faked: the session goes through
 * the same reducer, so the activity log, the plan and the resolution record
 * are exactly what clicking through would have produced.
 */
function fastForwardResolve(state: RootState, ticketId: string): RootState {
  const ticket = getTicket(ticketId)
  if (!ticket) return state
  let next = state
  for (let i = 0; i < 40; i++) {
    const session = sessionOf(next, ticket)
    if (session.status === 'resolved') return next
    const steps = ticket.suggestion?.steps ?? []
    const running = steps.find((step) => session.steps[step.id] === 'running')
    const drafted = steps.find((step) => step.draft && session.steps[step.id] === 'awaiting_confirm')
    const action: SessionAction | undefined = running
      ? { type: 'COMPLETE_STEP', stepId: running.id }
      : session.verify?.state === 'watching'
        ? { type: 'VERIFICATION_PASSED', checkId: session.verify.checkId }
        : drafted
          ? { type: 'POST_STEP_DRAFT', stepId: drafted.id }
          : session.resolveOpen
            ? { type: 'RESOLVE' }
            : nextAction(ticket, session, 'assignee').primary?.action
    if (!action) return next
    const after = applyTicket(next, ticketId, action)
    if (after === next) return next
    next = after
  }
  return next
}

/* ------------------------------------------------------------------
   Candidates. Readiness is derived from facts the fixtures already
   hold — ownership from the assignee, exclusions from the pattern,
   confidence from the related link — so every row can say why.
   ------------------------------------------------------------------ */

export interface CandidateGroups {
  pattern: ResolutionPattern
  /** Actionable: pre-checked at or above the threshold, opt-in below it. */
  ready: Candidate[]
  /** Somebody else's ticket. Excluded until a takeover lands. */
  owner: Candidate[]
  excluded: Candidate[]
  /** Below the list floor or a different cause — collapsed. */
  notIncluded: Candidate[]
}

export function candidatesFor(pattern: ResolutionPattern): CandidateGroups {
  const source = getTicket(pattern.sourceTicketId)
  const cohort = getCohort(pattern.cohortId)
  const groups: CandidateGroups = { pattern, ready: [], owner: [], excluded: [], notIncluded: [] }
  if (!source || !cohort) return groups

  for (const link of source.related) {
    const ticket = getTicket(link.ticketId)
    if (!ticket) continue
    const base = { ticketId: ticket.id, confidence: link.confidence, defaultSelected: false }

    if (ticket.cohortId !== pattern.cohortId || link.confidence < cohort.listFloor) {
      groups.notIncluded.push({ ...base, readiness: 'excluded', reason: link.reason })
      continue
    }
    const exclusion = pattern.exclusions[ticket.id]
    if (exclusion) {
      groups.excluded.push({
        ...base,
        readiness: 'excluded',
        reason: exclusion.reason,
        alternative: exclusion.alternative,
      })
      continue
    }
    const reason = pattern.notes[ticket.id] ?? link.reason
    if (ticket.assigneeId !== CURRENT_USER) {
      groups.owner.push({ ...base, readiness: 'blocked_owner', reason })
      continue
    }
    groups.ready.push({
      ...base,
      readiness: 'ready',
      reason,
      defaultSelected: link.confidence >= cohort.threshold,
    })
  }
  return groups
}

export function isSelected(state: RootState, patternId: string, candidate: Candidate): boolean {
  return state.selections[patternId]?.[candidate.ticketId] ?? candidate.defaultSelected
}

export function selectedIds(pattern: ResolutionPattern, state: RootState): string[] {
  return candidatesFor(pattern)
    .ready.filter((candidate) => isSelected(state, pattern.id, candidate))
    .map((candidate) => candidate.ticketId)
}

/* ------------------------------------------------------------------
   Derived run state
   ------------------------------------------------------------------ */

export interface RunItemView {
  item: WorkflowRunItem
  ticket: Ticket
  session: TicketSession
  state: RunItemState
}

export function itemState(item: WorkflowRunItem, ticket: Ticket, session: TicketSession): RunItemState {
  if (item.handedBack) return 'skipped'
  if (!item.started) return 'queued'
  if (session.status === 'resolved') return 'resolved'
  if (session.failed) return 'failed'
  if (session.status === 'on_hold' || session.verify?.state === 'watching') {
    return 'awaiting_verification'
  }
  const step = currentStep(ticket, session)
  if (step && session.steps[step.id] === 'pending' && !isBlocked(step, session)) {
    if (step.actor === 'assignee') return 'needs_input'
    // Pulled back behind an approval in the proposed workflow: the batch
    // confirm doesn't cover it, so it waits for Grant on each ticket.
    if (
      step.actor === 'agent' &&
      automationFor(step, session).kind === 'confirm' &&
      !session.preApproved[step.id]
    ) {
      return 'needs_input'
    }
  }
  return 'running'
}

export function runItems(run: WorkflowRun, state: RootState): RunItemView[] {
  return run.items
    .map((item) => {
      const ticket = getTicket(item.ticketId)
      if (!ticket) return undefined
      const session = sessionOf(state, ticket)
      return { item, ticket, session, state: itemState(item, ticket, session) }
    })
    .filter((row): row is RunItemView => Boolean(row))
}

const ACTIVE: ReadonlySet<RunItemState> = new Set(['queued', 'running', 'needs_input', 'failed'])

export function runStatus(run: WorkflowRun, items: RunItemView[]): RunStatus {
  if (run.phase === 'preflight') return 'preflight'
  if (run.phase === 'cancelled') return 'cancelled'
  if (items.some((row) => ACTIVE.has(row.state))) return 'running'
  if (items.some((row) => row.state === 'awaiting_verification')) return 'awaiting_verification'
  if (items.some((row) => row.state === 'skipped')) return 'completed_with_exceptions'
  return 'completed'
}

export function isRunLive(status: RunStatus): boolean {
  return status === 'running' || status === 'awaiting_verification'
}

/** The run a source ticket's bulk action already started, if any. */
export function runForSource(state: RootState, ticketId: string): WorkflowRun | undefined {
  return state.runOrder
    .map((id) => state.runs[id])
    .reverse()
    .find((run) => run.sourceTicketId === ticketId && run.phase !== 'cancelled')
}

export function nextRunId(state: RootState): string {
  return `run-${state.runOrder.length + 1}`
}
