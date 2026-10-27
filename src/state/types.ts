import type {
  ActivityEvent,
  ActivityStub,
  ComposerMode,
  DraftAttachment,
  HoldSpec,
  ResolutionDraft,
  ResolutionRecord,
  SlackMessage,
  Status,
} from '@/data/types'

/** Unstarted → Diagnosing → Acting → On hold → Resolved. */
export type PhaseKey = 'unstarted' | 'diagnosing' | 'acting' | 'on_hold' | 'resolved'

/**
 * `blocked` is deliberately absent: it is derived from `dependsOn` plus these
 * states in `selectors.ts`, so a dependency edit can never leave a stale flag
 * behind. `awaiting_confirm` covers both senses of "needs a human before this
 * finishes" — an approval gate, and a drafted reply waiting to be posted.
 */
export type StepRunState = 'pending' | 'running' | 'awaiting_confirm' | 'done' | 'skipped'

export interface TicketSession {
  status: Status
  phase: PhaseKey
  steps: Record<string, StepRunState>
  /** Newest-first, prepended — fixture activity is newest-first too. */
  appended: ActivityEvent[]
  composer: { mode: ComposerMode; body: string; fromAgent: boolean }
  hold?: { spec: HoldSpec; nudgesSent: number }
  verify?: { checkId: string; state: 'idle' | 'watching' | 'passed' }
  resolveOpen: boolean
  /**
   * Committed target per SLA label, seeded from the fixture. Only an explicit
   * review moves it, so the rail can always say what the policy row said.
   */
  slaTargets: Record<string, string>
  /** The open review's draft. A change cannot commit without `reason`. */
  slaDraft: { targets: Record<string, string>; reason: string | null }
  /** Rail-side review, for re-cutting a target after work has started. */
  slaReviewOpen: boolean
  /** The plan is a suggestion, and this is the mode where it can be edited. */
  planEditing: boolean
  /**
   * Steps Grant has pulled back from the agent: keyed by step id, these run
   * behind an approval gate even where the fixture grants `auto`. Autonomy is
   * revocable per step, never silently.
   */
  requireApproval: Record<string, boolean>
  draft: ResolutionDraft
  resolution?: ResolutionRecord
  /** Bulk stays visible but locked until one resolution is verified. */
  bulkUnlocked: boolean
  /**
   * Set when starting work sent the committed targets to the requester in
   * Slack — the confirmation shown in the action card until dismissed.
   */
  slaSent?: { to: string; targets: string }
  /**
   * Drafts agent steps hand over, keyed by step id and seeded from the
   * fixture. Edited in place on the step, so what Grant reviews is exactly
   * what goes out.
   */
  stepDrafts: Record<string, StepDraftState>
  /** Step id whose confirm gate is currently open. */
  confirming?: string
  /**
   * Set while a bulk run — or a saved workflow — is driving this ticket. It
   * does not keep a parallel copy of the steps: it drives *this* session, so
   * opening the ticket mid-run shows the same rows advancing.
   */
  driver?: SessionDriver
  /**
   * Gates approved ahead of time — by the batch confirm at preflight. A
   * pre-approved confirm step starts like an Auto one, and a pre-approved
   * draft posts as soon as it is written: every message was read at preflight.
   */
  preApproved: Record<string, boolean>
  /** The step that last failed, with the error, until it is retried. */
  failed?: { stepId: string; label: string; detail: string }
  /** Runs attempted per step — what an authored `fault` counts against. */
  attempts: Record<string, number>
  /**
   * Messages added to the ticket's Slack thread this session — public replies
   * mirror here, and quick replies from the rail land here directly.
   */
  slack: SlackMessage[]
  /** Monotonic counter for generated activity ids. */
  seq: number
}

export interface SessionDriver {
  kind: 'run' | 'workflow'
  id: string
  /** How the activity log names it, e.g. `run-1`. */
  label: string
}

export interface StepDraftState {
  body: string
  attachments: DraftAttachment[]
  /** Grant has changed the agent's version. */
  edited: boolean
}

export type SessionAction =
  | { type: 'START' }
  | { type: 'RUN_STEP'; stepId: string }
  | { type: 'REQUEST_CONFIRM'; stepId: string }
  | { type: 'APPROVE_STEP'; stepId: string }
  | { type: 'CANCEL_CONFIRM' }
  | { type: 'CONFIRM_STEP'; stepId: string }
  | { type: 'COMPLETE_STEP'; stepId: string }
  | { type: 'MARK_STEP_DONE'; stepId: string }
  | { type: 'SKIP_STEP'; stepId: string }
  | { type: 'RESTORE_STEP'; stepId: string }
  | { type: 'TOGGLE_PLAN_EDIT' }
  | { type: 'SET_REQUIRE_APPROVAL'; stepId: string; value: boolean }
  | { type: 'RUN_WORKFLOW'; workflowId: string }
  | { type: 'COMPOSER_MODE'; mode: ComposerMode }
  | { type: 'COMPOSER_BODY'; body: string }
  | { type: 'LOAD_DRAFT'; stepId: string }
  | {
      type: 'EDIT_STEP_DRAFT'
      stepId: string
      patch: Partial<Pick<StepDraftState, 'body' | 'attachments'>>
    }
  | { type: 'RESET_STEP_DRAFT'; stepId: string }
  | { type: 'POST_STEP_DRAFT'; stepId: string }
  | { type: 'POST_UPDATE' }
  /** The requester writing from the portal. Answers a hold that waits on them. */
  | { type: 'REQUESTER_REPLY'; body: string }
  /** A quick reply typed into the rail's Slack thread. */
  | { type: 'SLACK_REPLY'; body: string }
  | { type: 'HOLD'; spec: HoldSpec }
  | { type: 'SEND_NUDGE' }
  | { type: 'RESUME' }
  | { type: 'START_VERIFICATION'; checkId: string }
  | { type: 'VERIFICATION_PASSED'; checkId: string }
  | { type: 'SET_SLA_TARGET'; slaLabel: string; target: string }
  | { type: 'SET_SLA_REASON'; reason: string }
  | { type: 'OPEN_SLA_REVIEW' }
  | { type: 'CANCEL_SLA_REVIEW' }
  | { type: 'COMMIT_SLA' }
  | { type: 'DISMISS_SLA_SENT' }
  | { type: 'OPEN_RESOLVE' }
  | { type: 'CANCEL_RESOLVE' }
  | { type: 'RESOLVE_DRAFT'; patch: Partial<ResolutionDraft> }
  | { type: 'RESOLVE' }
  | { type: 'RESET' }
  /** A bulk run takes the ticket: start (or resume) and pre-approve its gates. */
  | {
      type: 'BULK_START'
      driver: SessionDriver
      by: string
      /** Steps dropped from the proposed workflow — settle as skipped. */
      drop?: string[]
      /** Steps pulled back behind a per-ticket approval. */
      requireApproval?: string[]
      /** Extra instructions the agent follows on this ticket. */
      instructions?: string[]
    }
  /** The run stops driving the ticket; Grant picks it up one at a time. */
  | { type: 'HAND_BACK' }
  | { type: 'RETRY_STEP'; stepId: string }
  | { type: 'COMPOSER_PREFILL'; mode: ComposerMode; body: string }
  /** Something that happened elsewhere and belongs on this ticket's record. */
  | { type: 'LOG'; event: ActivityStub & { actorId: string } }
