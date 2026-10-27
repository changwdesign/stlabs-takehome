import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Flag, Users } from 'lucide-react'
import { Avatar, AvatarStack } from '@/components/ui/Avatar'
import { Button, IconButton, SplitButton } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, ReadOnlyValue } from '@/components/ui/Field'
import { Note, type NoteTone } from '@/components/ui/Note'
import { MetaField, Pill } from '@/components/ui/Pill'
import { SearchInput } from '@/components/ui/SearchInput'
import { Segmented } from '@/components/ui/Segmented'
import { Spinner } from '@/components/ui/Spinner'
import { StepProgress } from '@/components/ui/StepProgress'
import { TextArea } from '@/components/ui/TextArea'
import { CollapsibleSection } from '@/components/ui/Collapsible'
import { RichText } from '@/components/ui/RichText'
import { SlackIcon } from '@/components/ui/SlackIcon'
import {
  PriorityBadge,
  Redacted,
  SlaBadge,
  StatusBadge,
  StatusDot,
  statusMeta,
} from '@/components/ui/badges'
import { UpdateComposer } from '@/components/ticket/UpdateComposer'
import { ActivityTimeline } from '@/components/ticket/ActivityTimeline'
import { StepRow } from '@/components/ticket/StepRow'
import { StepActorTag, ToolTag } from '@/components/ticket/StepActorTag'
import { NextActionCard } from '@/components/ticket/NextActionRegion'
import { ConfirmPanel, HoldPanel, VerificationPanel, VerificationPassed } from '@/components/ticket/panels'
import { BulkActionLock, RelatedTicketRow } from '@/components/rail/CohortSection'
import { PatternAudit } from '@/components/cohort/PatternAudit'
import { CandidateRow } from '@/components/cohort/CandidateRow'
import {
  RunItemBadge,
  RunStatusBadge,
  ScaleBadge,
  StepDots,
  itemStateMeta,
  runStatusMeta,
  scaleMeta,
} from '@/components/run/RunBadges'
import { getPattern } from '@/data/patterns'
import { candidatesFor, type WorkflowDraft } from '@/state/runs'
import { users, getUser } from '@/data/users'
import { getTicket, tickets } from '@/data/tickets'
import type {
  ComposerMode,
  Priority,
  ResolutionPattern,
  RunItemState,
  RunStatus,
  StepActor,
  StepScaleVerdict,
  Status,
  SuggestionStep,
} from '@/data/types'
import type { StepRunState } from '@/state/types'

const priorities: Priority[] = ['P1', 'P2', 'P3', 'P4', 'P5']
const statuses = Object.keys(statusMeta) as Status[]
const actors: StepActor[] = ['agent', 'assignee', 'requester', 'third_party']
const tones: NoteTone[] = ['muted', 'locked', 'ok', 'warn']

/**
 * Hand-maintained mirror of the `@theme static` block in index.css. Every new
 * token must be added here in the same commit — this is the easiest thing in
 * the whole prototype to forget.
 */
const tokenGroups: Array<{ group: string; tokens: string[] }> = [
  {
    group: 'Surfaces',
    tokens: [
      'canvas',
      'surface-list',
      'surface-rail',
      'surface-raised',
      'surface-pill',
      'surface-pill-alt',
      'surface-dock',
    ],
  },
  { group: 'Lines', tokens: ['line', 'line-subtle'] },
  { group: 'Text', tokens: ['ink', 'ink-muted', 'ink-faint'] },
  { group: 'Brand', tokens: ['accent', 'accent-soft', 'accent-btn', 'accent-btn-hover'] },
  {
    group: 'Priority',
    tokens: ['p1', 'p1-soft', 'p2', 'p2-soft', 'p3', 'p3-soft', 'p4', 'p4-soft', 'p5', 'p5-soft'],
  },
  {
    group: 'Status',
    tokens: [
      'status-open',
      'status-open-soft',
      'status-progress',
      'status-progress-soft',
      'status-on-hold',
      'status-on-hold-soft',
      'status-resolved',
      'status-resolved-soft',
      'status-closed',
      'status-closed-soft',
      'status-cancelled',
      'status-cancelled-soft',
    ],
  },
  {
    group: 'Step execution',
    tokens: [
      'step-running',
      'step-running-soft',
      'step-done',
      'step-done-soft',
      'step-blocked',
      'step-blocked-soft',
      'step-confirm',
      'step-confirm-soft',
    ],
  },
  {
    group: 'Feedback',
    tokens: ['danger', 'danger-soft', 'ok', 'lock', 'sla-paused', 'sla-paused-soft', 'focus'],
  },
  { group: 'Demo', tokens: ['demo', 'demo-ink', 'demo-soft'] },
  {
    group: 'Avatars',
    tokens: ['avatar-warm', 'avatar-warm-ink', 'avatar-deep', 'avatar-deep-ink'],
  },
]

const showcase = getTicket('tkt-1')
const kitPattern = getPattern('pat-sso-cli')
const kitGroups = kitPattern ? candidatesFor(kitPattern) : undefined
const planSteps = showcase?.suggestion?.steps ?? []
const agentStep = planSteps[0]
const manualStep = planSteps[1]
const confirmStep = planSteps[2]
const draftStep = planSteps[3]
const verifyStep = planSteps[4]

/** The six StepRow states: five run states plus derived blocked-ness. */
const stepStates: Array<{ caption: string; state: StepRunState; blocked?: boolean; step?: SuggestionStep }> = [
  { caption: 'pending', state: 'pending', step: agentStep },
  { caption: 'running', state: 'running', step: agentStep },
  { caption: 'awaiting_confirm', state: 'awaiting_confirm', step: confirmStep },
  { caption: 'done (with receipt)', state: 'done', step: agentStep },
  { caption: 'skipped', state: 'skipped', step: manualStep },
  { caption: 'blocked (derived from dependsOn)', state: 'pending', blocked: true, step: confirmStep },
]

export function KitPage() {
  const [mode, setMode] = useState<ComposerMode>('public')
  const [checked, setChecked] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div className="scrollbar-thin h-screen overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-[1100px] px-10 py-12">
        <Link
          to="/"
          className="mb-8 inline-flex items-center gap-2 text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to inbox
        </Link>

        <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-ink">Component kit</h1>
        <p className="mt-2 max-w-[70ch] text-[15px] text-ink-muted">
          Every primitive in every state, plus the full token palette. Compose new workflow
          screens from these rather than writing fresh markup — and add tokens to{' '}
          <code className="font-mono text-ink">src/index.css</code> rather than hardcoding colors.
        </p>

        <Section title="Color tokens">
          <div className="flex flex-col gap-7">
            {tokenGroups.map(({ group, tokens }) => (
              <div key={group}>
                <h3 className="mb-3 text-[13px] font-medium text-ink-muted">{group}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
                  {tokens.map((token) => (
                    <Swatch key={token} token={token} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Priority badges">
          <Row>
            {priorities.map((p) => (
              <PriorityBadge key={p} priority={p} />
            ))}
          </Row>
        </Section>

        <Section title="Status">
          <Row>
            {statuses.map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </Row>
          <Row>
            {statuses.map((s) => (
              <StatusDot key={s} status={s} />
            ))}
          </Row>
          <p className="text-[12px] text-ink-muted">
            `closed` and `cancelled` are typed and shown here, but have no entry point in the UI
            this pass. Same for Reopened and escalation.
          </p>
        </Section>

        <Section title="SLA badges">
          <Row>
            <SlaBadge value="+1d" state="breached" />
            <SlaBadge value="58m" state="at_risk" />
            <SlaBadge value="4h" state="ok" />
            <SlaBadge value="1d 4h" state="paused" />
          </Row>
        </Section>

        <Section title="Buttons">
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="subtle">Subtle</Button>
            <Button variant="tab">Tab</Button>
            <Button variant="tabActive">Tab active</Button>
            <Button variant="primary" busy>
              Running
            </Button>
            <Button variant="subtle" disabled>
              Disabled
            </Button>
            <SplitButton>Post</SplitButton>
            <SplitButton disabled>Post</SplitButton>
            <IconButton label="Flag">
              <Flag className="h-4 w-4" strokeWidth={1.75} />
            </IconButton>
          </Row>
          <p className="text-[12px] text-ink-muted">
            Tab through these — every interactive element now takes a visible focus ring.
          </p>
        </Section>

        <Section title="Segmented, checkbox, spinner, progress">
          <Row>
            <Segmented
              label="Demo"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'public', label: 'Public reply' },
                { value: 'internal', label: 'Internal note' },
                { value: 'secure', label: 'Secure send' },
              ]}
            />
          </Row>
          <Row>
            <Checkbox checked={checked} onChange={setChecked} label="Mark this step done" />
            <Checkbox checked onChange={() => {}} label="Already done" />
            <Checkbox checked={false} disabled onChange={() => {}} label="Blocked" />
          </Row>
          <Row>
            <Spinner />
            <StepProgress done={0} total={5} />
            <StepProgress done={3} total={5} />
            <StepProgress done={5} total={5} />
          </Row>
        </Section>

        <Section title="Notes — four tones">
          <div className="flex max-w-[640px] flex-col gap-2">
            {tones.map((tone) => (
              <Note key={tone} tone={tone}>
                <span className="font-medium">{tone}</span> — one component instead of five ad-hoc
                divs. Every grant, lock and gate explains itself.
              </Note>
            ))}
          </div>
        </Section>

        <Section title="Fields">
          <div className="flex max-w-[560px] flex-col gap-4">
            <Field label="Time to resolve" hint="authored, not computed">
              <ReadOnlyValue>1h 12m</ReadOnlyValue>
            </Field>
            <Field label="Note" hint="optional">
              <div className="rounded-xl border border-line-subtle bg-canvas p-3">
                <TextArea
                  rows={2}
                  value={note}
                  placeholder="Controlled textarea…"
                  onChange={(event) => setNote(event.target.value)}
                />
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Step actors & tools">
          <Row>
            {actors.map((actor) => (
              <StepActorTag key={actor} actor={actor} />
            ))}
            <StepActorTag actor="agent" automation="auto" />
            <StepActorTag actor="agent" automation="confirm" />
          </Row>
          <Row>
            <ToolTag tool={{ label: '1Password admin console', icon: 'onepassword' }} />
            <ToolTag tool={{ label: 'Portal → Slack', icon: 'slack' }} />
            <ToolTag tool={{ label: 'Okta', icon: 'okta' }} />
            <ToolTag tool={{ label: '1Password CLI', icon: 'browser' }} />
          </Row>
        </Section>

        <Section title="Step rows — all six states">
          <div className="flex max-w-[760px] flex-col gap-8">
            {stepStates.map(({ caption, state, blocked, step }) =>
              step ? (
                <div key={caption} className="flex flex-col gap-2">
                  <span className="font-mono text-[11px] text-ink-faint">{caption}</span>
                  <ol className="pl-3">
                    <StepRow
                      step={step}
                      index={1}
                      state={state}
                      blocked={blocked}
                      blockedBy={blocked ? 'Correct the profile email' : undefined}
                    />
                  </ol>
                </div>
              ) : null,
            )}
            {verifyStep ? (
              <div className="flex flex-col gap-2">
                <span className="font-mono text-[11px] text-ink-faint">
                  watching (automatic verification)
                </span>
                <ol className="pl-3">
                  <StepRow step={verifyStep} index={5} state="pending" watching />
                </ol>
              </div>
            ) : null}
          </div>
        </Section>

        <Section title="Next-action card">
          <div className="flex max-w-[760px] flex-col gap-4">
            <NextActionCard
              descriptor={{
                eyebrow: 'Unstarted',
                title: 'Start resolving',
                detail:
                  'Response SLA is breached at +1d. It is one of 8 tickets from the SSO enforcement rollout.',
                primary: { label: 'Approve steps and start resolving', action: { type: 'START' } },
              }}
            />
            <NextActionCard
              descriptor={{
                eyebrow: 'Resolved',
                title: 'Profile email did not match the IdP',
                detail: 'Captured in 1h 12m against a 2h target.',
              }}
              resolved
            />
          </div>
          <p className="text-[12px] text-ink-muted">
            Exactly one of these renders per page, directly under the h1. It is the only
            deliberately loud surface in the design — a second one would cancel the hierarchy it
            exists to create.
          </p>
        </Section>

        <Section title="Confirm, verification & hold panels">
          <div className="flex max-w-[640px] flex-col gap-5">
            {confirmStep ? <ConfirmPanel step={confirmStep} /> : null}
            {verifyStep?.verification ? (
              <>
                <VerificationPanel check={verifyStep.verification} />
                <VerificationPassed check={verifyStep.verification} />
                <HoldPanel spec={verifyStep.verification.fallback!.hold} nudgesSent={1} />
              </>
            ) : null}
          </div>
        </Section>

        <Section title="Cohort rail pieces">
          <div className="flex max-w-[360px] flex-col gap-4">
            <BulkActionLock count={7} unlocked={false} />
            <BulkActionLock count={7} unlocked />
            {showcase?.related.slice(0, 2).map((link) => {
              const other = getTicket(link.ticketId)
              return other ? (
                <RelatedTicketRow
                  key={link.ticketId}
                  ticket={other}
                  reason={link.reason}
                  confidence={link.confidence}
                  included={link.confidence >= 0.7}
                />
              ) : null
            })}
            {showcase?.related.slice(-1).map((link) => {
              const other = getTicket(link.ticketId)
              return other ? (
                <RelatedTicketRow
                  key={link.ticketId}
                  ticket={other}
                  reason={link.reason}
                  confidence={link.confidence}
                  included={false}
                />
              ) : null
            })}
          </div>
        </Section>

        <Section title="Bulk — scale verdicts, run items, run status">
          <div className="flex flex-col gap-3">
            <Row>
              {(Object.keys(scaleMeta) as StepScaleVerdict[]).map((verdict) => (
                <ScaleBadge key={verdict} verdict={verdict} />
              ))}
            </Row>
            <Row>
              {(Object.keys(itemStateMeta) as RunItemState[]).map((state) => (
                <RunItemBadge key={state} state={state} />
              ))}
            </Row>
            <Row>
              {(Object.keys(runStatusMeta) as RunStatus[]).map((status) => (
                <RunStatusBadge key={status} status={status} />
              ))}
            </Row>
            <Row>
              <StepDots states={['done', 'skipped', 'running', 'pending', 'pending']} />
              <StepDots states={['done', 'skipped', 'failed', 'pending', 'pending']} />
              <StepDots states={['done', 'done', 'done', 'done', 'done']} />
            </Row>
          </div>
        </Section>

        {kitPattern && showcase ? (
          <Section title="Bulk — pattern audit & candidate rows">
            <div className="flex max-w-[680px] flex-col gap-4">
              <PatternAudit pattern={kitPattern} steps={showcase.suggestion?.steps ?? []} />
              <KitWorkflowEditor pattern={kitPattern} steps={showcase.suggestion?.steps ?? []} />
              <ul className="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-xl border border-line">
                {[kitGroups?.ready[0], kitGroups?.owner[0], kitGroups?.excluded.find((c) => c.alternative)].map(
                  (candidate) => {
                    const other = candidate ? getTicket(candidate.ticketId) : undefined
                    return candidate && other ? (
                      <CandidateRow
                        key={candidate.ticketId}
                        ticket={other}
                        candidate={candidate}
                        status={other.status}
                        checked={candidate.defaultSelected}
                      />
                    ) : null
                  },
                )}
              </ul>
            </div>
          </Section>
        ) : null}

        <Section title="Avatars">
          <Row>
            {(['xs', 'sm', 'md', 'lg'] as const).map((size) => (
              <Avatar key={size} user={getUser('aidan')} size={size} />
            ))}
            <Avatar user={getUser('grant')} size="lg" />
            <Avatar user={getUser('agent')} size="lg" />
          </Row>
          <Row>
            <AvatarStack users={users.filter((u) => u.kind === 'person').slice(0, 4)} />
          </Row>
        </Section>

        <Section title="Pills & meta fields">
          <Row>
            <Pill icon={<StatusDot status="open" />}>Open</Pill>
            <Pill icon={<StatusDot status="on_hold" />}>On hold</Pill>
            <Pill icon={<Users className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />}>
              IT Requests
            </Pill>
            <Pill lead="avatar" icon={<Avatar user={getUser('grant')} size="sm" />}>Grant Fuhr</Pill>
            <Pill lead="avatar" icon={<Avatar user={getUser('aidan')} size="sm" />} interactive={false}>
              Aidan Singh
            </Pill>
          </Row>
          <Row>
            <MetaField label="Queue">
              <Pill icon={<Users className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />}>
                Access &amp; Identity
              </Pill>
            </MetaField>
          </Row>
        </Section>

        <Section title="Inputs">
          <div className="flex max-w-[560px] flex-col gap-4">
            <SearchInput placeholder="Search tickets" />
            <SearchInput size="lg" placeholder="Run a workflow..." trailing="39 available" />
          </div>
        </Section>

        <Section title="Composer — three modes">
          <div className="max-w-[720px]">
            {/* Rendered with no session at all: any coupling to one breaks /kit. */}
            <UpdateComposer />
          </div>
          <div className="flex max-w-[720px] flex-col gap-4">
            {(['public', 'internal', 'secure'] as ComposerMode[]).map((m) => (
              <UpdateComposer
                key={m}
                mode={m}
                body={m === 'public' ? draftStep?.draft?.body : 'Internal context for the queue…'}
                fromAgent={m === 'public'}
              />
            ))}
          </div>
        </Section>

        <Section title="Collapsible rail section">
          <div className="max-w-[360px] overflow-hidden rounded-2xl border border-line-subtle bg-canvas">
            <CollapsibleSection title="Open by default" icon={<Flag className="h-4 w-4" />}>
              <p className="pl-6 text-[13px] text-ink-muted">Section body.</p>
            </CollapsibleSection>
            <CollapsibleSection
              title="Closed, with a trailing summary"
              icon={<Flag className="h-4 w-4" />}
              defaultOpen={false}
              trailing="8 tickets"
            >
              <p className="pl-6 text-[13px] text-ink-muted">Section body.</p>
            </CollapsibleSection>
          </div>
        </Section>

        <Section title="Activity timeline">
          <div className="max-w-[720px]">
            <ActivityTimeline
              events={[
                {
                  id: 'kit-1',
                  actorId: 'agent',
                  verb: 'checked SSO enrollment for',
                  object: 'Aidan Singh',
                  trailing: '— not enrolled',
                  time: 'just now',
                  detail: agentStep?.outcome?.body,
                },
                ...tickets[0].activity,
              ]}
            />
          </div>
        </Section>

        <Section title="Rich text & misc">
          <p className="max-w-[80ch] text-[15px] leading-relaxed text-ink">
            <RichText
              segments={[
                { kind: 'text', value: 'Run ' },
                { kind: 'code', value: 'op signin --account stlabs.1password.com' },
                { kind: 'text', value: ' then confirm the account is ' },
                { kind: 'strong', value: 'enrolled' },
                { kind: 'text', value: '.' },
              ]}
            />
          </p>
          <Row>
            <span className="inline-flex items-center gap-2 text-[13px] text-ink-muted">
              <SlackIcon />
              View original conversation
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Redacted width={60} />
              <Redacted width={90} />
              <Redacted width={40} />
            </span>
          </Row>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-12 border-t border-line-subtle pt-8">
      <h2 className="mb-5 text-[17px] font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  )
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-4">{children}</div>
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="h-9 w-9 shrink-0 rounded-lg border border-line-subtle"
        style={{ background: `var(--color-${token})` }}
      />
      <span className="min-w-0 truncate font-mono text-[11px] text-ink-muted">{token}</span>
    </div>
  )
}

/** The proposed workflow in its editable state, with local edits pre-seeded. */
function KitWorkflowEditor({
  pattern,
  steps,
}: {
  pattern: ResolutionPattern
  steps: SuggestionStep[]
}) {
  const [draft, setDraft] = useState<WorkflowDraft>({
    dropped: {},
    requireApproval: { 's-enroll': true },
    instructions: [{ id: 'kit-1', text: 'CC each requester’s manager on the reply.' }],
  })
  const toggle = (record: Record<string, true>, key: string, value: boolean) => {
    const next = { ...record }
    if (value) next[key] = true
    else delete next[key]
    return next
  }
  return (
    <PatternAudit
      pattern={pattern}
      steps={steps}
      draft={draft}
      edits={{
        onRename: (name) => setDraft((d) => ({ ...d, name })),
        onDrop: (id, value) => setDraft((d) => ({ ...d, dropped: toggle(d.dropped, id, value) })),
        onRequireApproval: (id, value) =>
          setDraft((d) => ({ ...d, requireApproval: toggle(d.requireApproval, id, value) })),
        onAddInstruction: (text) =>
          setDraft((d) => ({ ...d, instructions: [...d.instructions, { id: `kit-${Date.now()}`, text }] })),
        onRemoveInstruction: (id) =>
          setDraft((d) => ({ ...d, instructions: d.instructions.filter((i) => i.id !== id) })),
      }}
    />
  )
}
