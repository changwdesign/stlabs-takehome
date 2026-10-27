export type Priority = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'

/**
 * Six statuses, no `waiting` — "waiting on the requester" is `on_hold` carrying a
 * `HoldSpec` that names *what* is being waited on. `closed` and `cancelled` are
 * typed and present in `/kit` but have no entry point in the UI yet.
 */
export type Status = 'open' | 'in_progress' | 'on_hold' | 'resolved' | 'closed' | 'cancelled'

export type QueueName =
  | 'IT Requests'
  | 'Access & Identity'
  | 'Hardware'
  | 'Procurement'
  | 'Security'

export interface User {
  id: string
  name: string
  initials: string
  /** `agent` renders as a rounded-square brand tile; `person` as a circle. */
  kind: 'person' | 'agent'
  title?: string
  team?: string
  reportsTo?: string
  deviceCount?: number
  appCount?: number
  /** Directory groups, shown in the requester card. */
  groups?: string[]
  /** Token name for the avatar fill, e.g. `avatar-warm`. */
  tone?: 'warm' | 'deep' | 'accent'
}

/** A single step inside an agent suggestion. Segments let us mix prose and code. */
export type TextSegment =
  | { kind: 'text'; value: string }
  | { kind: 'strong'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; value: string }

/** The composer's three consequences. Visible as a segmented control, never a menu. */
export type ComposerMode = 'public' | 'internal' | 'secure'

/* ------------------------------------------------------------------
   Plan model.

   Split rule: fixtures define the plan, session state owns the
   execution. A step's actor, tool, automation class and dependencies
   live here; its run state lives in `src/state/` and never touches
   `Ticket`.
   ------------------------------------------------------------------ */

export type StepActor = 'agent' | 'assignee' | 'requester' | 'third_party'

export interface StepTool {
  label: string
  icon?: 'onepassword' | 'slack' | 'okta' | 'portal' | 'browser' | 'mail'
}

/**
 * How much autonomy the agent has on this step.
 * `auto` — reversible, low blast radius, inside the assignee's own scope.
 * `confirm` — irreversible, credential-bearing, or affecting another user.
 * `because` is rendered verbatim, so every grant or gate explains itself.
 */
export type Automation =
  | { kind: 'manual' }
  | { kind: 'auto'; because: string }
  | { kind: 'confirm'; because: string }

/** A file riding along with a drafted message. */
export interface DraftAttachment {
  name: string
  size: string
}

/** A message an agent step drafts for the assignee to review and send. */
export interface StepDraft {
  mode: ComposerMode
  body: string
  attachments?: DraftAttachment[]
}

export type ActivityStub = Pick<ActivityEvent, 'verb' | 'object' | 'trailing' | 'action'>

export interface SuggestionStep {
  /** Stable id — the session key. Never positional. */
  id: string
  label: string
  body: TextSegment[]
  actor: StepActor
  tool: StepTool
  automation: Automation
  /** By id, not index. Blocked-ness is DERIVED from this, never stored. */
  dependsOn?: string[]
  workflowId?: string
  /** Button copy while the agent is working, e.g. "Reading enrollment…". */
  runLabel?: string
  runDurationMs?: number
  /** What the step produced — the receipt shown under it once done. */
  outcome?: { body: TextSegment[]; activity: ActivityStub }
  draft?: StepDraft
  verification?: VerificationCheck
  /**
   * Set where the agent's check already showed this step is unnecessary for
   * this ticket. The step stays in the plan, so the pattern keeps one shape
   * across a cohort, and settles as skipped with this reason.
   */
  notNeeded?: string
  /**
   * An authored failure: the first `attempts` runs of this step fail with this
   * error. Exceptions are in scope, and a random one would not demo twice.
   */
  fault?: { label: string; detail: string; attempts: number }
}

export interface VerificationCheck {
  id: string
  /**
   * `automatic` is preferred: where a programmatic check exists the ticket
   * self-verifies and the requester is informed, not interrogated.
   */
  mode: 'automatic' | 'requester'
  /** Present tense — rendered while watching. */
  label: string
  durationMs: number
  /** What happens if nobody replies. */
  followUp: string
  /** The receipt once the check passes. */
  passed: TextSegment[]
  /** Where to go when the automatic check can't settle it. */
  fallback?: { label: string; hold: HoldSpec }
}

export interface HoldSpec {
  reason: 'awaiting_requester' | 'awaiting_third_party' | 'awaiting_change_window'
  /** Names what is being waited on, in the ticket's own words. */
  label: string
  /** Requester latency shouldn't score against the assignee. */
  pausesSla: boolean
  /** Verification check that would clear the hold, if one exists. */
  check?: string
  /** Follow-up cadence, authored — this prototype has no clocks. */
  cadence?: string
  /**
   * The same hold in the requester's words, for the portal. `label` is
   * written for the assignee ("Waiting on Aidan to…"); this is the ask.
   */
  ask?: { title: string; detail?: TextSegment[] }
}

export interface ResolutionCause {
  id: string
  label: string
  detail?: string
}

export interface ResolutionDraft {
  causeId: string | null
  workflowIds: string[]
  note: string
  /** Preventive action: tell the not-yet-affected population before they file. */
  notifyCohort: boolean
}

export interface ResolutionRecord {
  causeId: string
  causeLabel: string
  workflowIds: string[]
  note: string
  notifyCohort: boolean
  /** Authored, not computed — see "Known awkwardness" in the plan. */
  timeToResolve: string
  target: string
  withinTarget: boolean
}

/** Authored actual-vs-estimate figures, since there are no clocks in this app. */
export interface TicketExpectation {
  timeToResolve: string
  target: string
  withinTarget: boolean
}

/** A related ticket plus *why* it is related. No unexplained inclusions. */
export interface RelatedLink {
  ticketId: string
  reason: string
  /** 0–1. Above the cohort threshold → pre-checked for bulk; below → opt-in. */
  confidence: number
}

export interface Cohort {
  id: string
  label: string
  /** One line of volume context, shown in the rail from page load. */
  blurb: string
  cause: string
  /** Confidence at or above which a candidate is pre-checked for bulk action. */
  threshold: number
  /** Below `threshold` but at or above this: listed, unchecked, opt-in. Below it: "Not included". */
  listFloor: number
  /** Affected population that hasn't filed yet — the preventive-action count. */
  notYetAffected: number
}

export type SuggestionChip =
  | { label: string; act: 'load_draft'; stepId: string }
  | { label: string; act: 'open_cohort' }
  | { label: string; act: 'explain' }
  | { label: string; act: 'none' }

export interface Suggestion {
  id: string
  title: string
  /** Prose shown above the card. */
  lede: string
  steps: SuggestionStep[]
  /** Workflows the agent matched — the search box is the fallback, not the entry. */
  workflowIds: string[]
  /** Pre-selects the cause in the resolve form: the diagnosis comes from the agent. */
  likelyCauseId?: string
  /** Quick-reply chips rendered under the card. */
  chips: SuggestionChip[]
}

export type ActivityActorRef = string

export interface ActivityEvent {
  id: string
  actorId: ActivityActorRef
  /** Rendered muted, between actor name and object. */
  verb: string
  /** Rendered in primary ink — the thing acted upon. */
  object?: string
  /** Trailing muted text after the object. */
  trailing?: string
  time: string
  /** Receipt rendered under the event — what an agent run actually changed. */
  detail?: TextSegment[]
  /** Optional right-aligned secondary action. */
  action?: { label: string; icon?: 'slack' | 'none' }
  /**
   * How this event reads in the requester's portal. Present means the
   * requester sees it; absent (internal notes, agent receipts, SLA re-cuts)
   * means they don't. Worded where the event is made, not guessed later.
   */
  portal?: { verb: string; object?: string; detail?: TextSegment[] }
}

/**
 * Where a ticket's targets came from. Carried in the fixture so the assignee
 * can *review* the commitment at the moment he picks the ticket up, instead
 * of inheriting it silently and finding out later it was the wrong row.
 */
export interface SlaPolicy {
  /** The policy row that produced the targets, e.g. `P2 · IT Requests`. */
  label: string
  /** Why that row applies to this ticket. Rendered verbatim. */
  basis: string
  /** Policy value per SLA label — the reference an override is measured against. */
  reference: Record<string, string>
  /** Selectable targets per SLA label. Closed list: a free-text clock is unauditable. */
  options: Record<string, string[]>
  /** The agent's suggestion where it differs from the policy row, with its reason. */
  suggestion?: { slaLabel: string; target: string; because: string }
  /** Reasons an override can cite. Closed list, for the same reason as `options`. */
  reasons: string[]
}

export interface SlaTarget {
  label: string
  value: string
  state: 'breached' | 'at_risk' | 'ok' | 'paused'
  /** The commitment the value is measured against, e.g. `2h`. */
  target?: string
  /** Whether a hold is allowed to stop this clock. */
  pausable?: boolean
}

export interface Ticket {
  id: string
  key: string
  title: string
  status: Status
  priority: Priority
  queue: QueueName
  assigneeId: string
  requesterId: string
  age: string
  updated: string
  summary: TextSegment[]
  sourceLabel?: string
  /** The Slack thread the ticket came from — replies mirror into it. */
  slack?: SlackThread
  suggestion?: Suggestion
  sla: SlaTarget[]
  /** The row `sla` came from — present on tickets whose targets are reviewable. */
  slaPolicy?: SlaPolicy
  followerIds: string[]
  related: RelatedLink[]
  activity: ActivityEvent[]
  /** Membership in a shared-cause group — drives the rail and bulk action. */
  cohortId?: string
  /** Pre-authored hold, for tickets that start life on hold. */
  hold?: HoldSpec
  expected?: TicketExpectation
  /** Masked rows in the source screenshots — renders as redacted blocks. */
  redacted?: boolean
}

/** One message in a ticket's Slack thread. */
export interface SlackMessage {
  id: string
  authorId: string
  time: string
  body: string
  /** Sent from the portal rather than typed in Slack. */
  fromPortal?: boolean
}

export interface SlackThread {
  channel: string
  /** Permalink to the thread — opens the Slack app where it is installed. */
  url: string
  /** Direct message with the requester, for anything off the thread. */
  dmUrl: string
  messages: SlackMessage[]
}

export interface Workflow {
  id: string
  name: string
  category: string
  /** Set on a workflow saved from a resolution, so it reads apart from stock ones. */
  createdBy?: string
  patternId?: string
}

/* ------------------------------------------------------------------
   Bulk. A proven resolution is audited for scale, applied to a set of
   candidates, and run as a workflow run — the same single-ticket
   machine, driven from a list.
   ------------------------------------------------------------------ */

/** A step's verdict when the proven pattern is audited for scale. */
export type StepScaleVerdict = 'auto_at_scale' | 'per_ticket_input' | 'blocks_bulk'

export type CandidateReadiness = 'ready' | 'needs_input' | 'blocked_owner' | 'excluded'

export interface Candidate {
  ticketId: string
  readiness: CandidateReadiness
  /** Always present — no unexplained inclusions *or* exclusions. */
  reason: string
  confidence: number
  /** Pre-checked at or above the cohort threshold, opt-in below it. */
  defaultSelected: boolean
  /** One-click alternative for an excluded ticket, so it is not a dead end. */
  alternative?: 'reply'
}

export interface ResolutionPattern {
  id: string
  name: string
  causeId: string
  sourceTicketId: string
  cohortId: string
  /** The source ticket's steps, by id, each with its verdict at scale. */
  steps: Array<{ stepId: string; scale: StepScaleVerdict; note: string }>
  matchCriteria: string[]
  /** Cohort members the pattern does not apply to, and why. */
  exclusions: Record<string, { reason: string; alternative?: 'reply'; replyBody?: string }>
  /** Readiness reasons for members it does apply to, keyed by ticket. */
  notes: Record<string, string>
}

/**
 * Lifecycle the run itself owns. Everything finer — running, waiting on
 * verification, completed with exceptions — is derived from the ticket
 * sessions the run drives, so the run and the tickets cannot disagree.
 */
export type RunPhase = 'preflight' | 'confirmed' | 'cancelled'

export type RunStatus =
  | 'preflight'
  | 'running'
  | 'awaiting_verification'
  | 'completed'
  | 'completed_with_exceptions'
  | 'cancelled'

export type RunItemState =
  | 'queued'
  | 'running'
  | 'needs_input'
  | 'failed'
  | 'awaiting_verification'
  | 'resolved'
  | 'skipped'

export interface WorkflowRunItem {
  ticketId: string
  /** The run has handed this ticket its BULK_START. */
  started: boolean
  /** Returned to the single-ticket flow; the run stops driving it. */
  handedBack: boolean
}

export interface WorkflowRun {
  id: string
  patternId: string
  sourceTicketId: string
  cohortId: string
  createdBy: string
  createdAtLabel: string
  phase: RunPhase
  items: WorkflowRunItem[]
  /** Set by "save as workflow". */
  savedWorkflowId?: string
  notifiedCohort?: boolean
}

/** A past run, shown in the index only. */
export interface RunHistoryEntry {
  id: string
  name: string
  createdBy: string
  createdAtLabel: string
  status: RunStatus
  total: number
  resolved: number
}
