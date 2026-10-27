import { Check, Lock, Minus, RotateCcw, ShieldAlert, SkipForward } from 'lucide-react'
import type { Automation, SuggestionStep } from '@/data/types'
import type { StepDraftState, StepRunState } from '@/state/types'
import { RichText } from '@/components/ui/RichText'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Note } from '@/components/ui/Note'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { StepActorTag, ToolTag } from './StepActorTag'
import { StepDraft } from './StepDraft'

/**
 * Six visual states from five run states plus derived blocked-ness. Pure —
 * it takes `state` and `blocked` rather than reading a session, which is the
 * only way `/kit` can show all six without faking one.
 */
export interface StepRowProps {
  step: SuggestionStep
  index: number
  state: StepRunState
  /** Derived from `dependsOn`, never stored. */
  blocked?: boolean
  /** Label of the dependency being waited on — blocked steps name it. */
  blockedBy?: string
  /** Set while an automatic check is watching on this step's behalf. */
  watching?: boolean
  /**
   * The plan is being *read*, not run — before work starts. Nothing is
   * actionable, but everything stays at full contrast: a plan you are being
   * asked to review has to be legible, which a dimmed one is not.
   */
  readOnly?: boolean
  /** Autonomy in force — `automationFor`, not the fixture's grant. */
  automation?: Automation
  /** Plan-edit mode: the step is being changed, not run. */
  editing?: boolean
  onRun?: () => void
  onRequestConfirm?: () => void
  onMarkDone?: () => void
  onStartVerification?: () => void
  onSkip?: () => void
  onRestore?: () => void
  onRequireApproval?: (value: boolean) => void
  /** The step's drafted message, once the agent has written it. */
  draft?: StepDraftState
  /** Who the draft goes to. */
  draftTo?: string
  onDraftChange?: (patch: Partial<Pick<StepDraftState, 'body' | 'attachments'>>) => void
  onResetDraft?: () => void
  onPostDraft?: () => void
}

export function StepRow({
  step,
  index,
  state,
  blocked = false,
  blockedBy,
  watching = false,
  readOnly = false,
  automation: automationProp,
  editing = false,
  onRun,
  onRequestConfirm,
  onMarkDone,
  onStartVerification,
  onSkip,
  onRestore,
  onRequireApproval,
  draft,
  draftTo,
  onDraftChange,
  onResetDraft,
  onPostDraft,
}: StepRowProps) {
  const done = state === 'done'
  const skipped = state === 'skipped'
  const running = state === 'running' || watching
  const awaiting = state === 'awaiting_confirm'
  const automation = automationProp ?? step.automation
  const pulledBack = automation.kind === 'confirm' && step.automation.kind === 'auto'

  return (
    <li
      className={cn(
        'flex gap-3 border-l-2 pl-4 transition-colors',
        done && 'border-step-done',
        skipped && 'border-line-subtle',
        running && 'border-step-running',
        awaiting && 'border-step-confirm',
        !done && !skipped && !running && !awaiting && (blocked ? 'border-line-subtle' : 'border-line'),
      )}
    >
      <Marker index={index} state={state} blocked={blocked} watching={watching} />

      <div className={cn('flex min-w-0 flex-1 flex-col gap-2 pb-1', (blocked || skipped) && 'opacity-70')}>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'text-[15px] font-semibold',
              done ? 'text-ink-muted line-through decoration-ink-muted decoration-[1.5px]' : 'text-ink',
            )}
          >
            {step.label}
          </span>
          <StepActorTag actor={step.actor} automation={automation.kind} />
          <ToolTag tool={step.tool} />
        </div>

        <p className="text-[14px] leading-relaxed text-ink-muted">
          <RichText segments={step.body} />
        </p>

        {blocked && blockedBy ? (
          <Note tone="locked" icon={<Lock className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            Blocked until <span className="text-ink-muted">{blockedBy}</span> is done.
          </Note>
        ) : null}

        {!blocked && automation.kind === 'confirm' && !done ? (
          <Note tone="warn" icon={<ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />}>
            {pulledBack ? 'Approval required by you' : 'Needs your approval'} — {automation.because}
          </Note>
        ) : null}

        {done && step.outcome && !(draft && draftTo) ? (
          // A finding, not a success state: neutral, like the receipt the
          // activity timeline shows for the same run.
          <div className="flex flex-col gap-1 rounded-lg border border-line-subtle bg-surface-raised/30 px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
              Result
            </span>
            <p className="text-[13px] leading-relaxed text-ink-muted">
              <RichText segments={step.outcome.body} />
            </p>
          </div>
        ) : null}

        {/* Review happens where the work is: the drafted message opens on
            its own step, not in a composer further down the page. */}
        {draft && draftTo && (awaiting || done) ? (
          <StepDraft
            to={draftTo}
            draft={draft}
            sent={done}
            onChange={onDraftChange}
            onReset={onResetDraft}
            onPost={onPostDraft}
          />
        ) : null}

        {skipped ? <Note tone="muted">Skipped.</Note> : null}

        {editing ? (
          <EditControls
            step={step}
            state={state}
            requireApproval={pulledBack}
            onSkip={onSkip}
            onRestore={onRestore}
            onRequireApproval={onRequireApproval}
          />
        ) : (
          <Controls
            step={step}
            state={state}
            blocked={blocked}
            watching={watching}
            readOnly={readOnly}
            automation={automation}
            onRun={onRun}
            onRequestConfirm={onRequestConfirm}
            onMarkDone={onMarkDone}
            onStartVerification={onStartVerification}
          />
        )}
      </div>
    </li>
  )
}

function Controls({
  step,
  state,
  blocked,
  watching,
  readOnly,
  automation,
  onRun,
  onRequestConfirm,
  onMarkDone,
  onStartVerification,
}: Omit<StepRowProps, 'index' | 'blockedBy'>) {
  const inert = blocked || readOnly
  const kind = (automation ?? step.automation).kind
  if (state === 'done' || state === 'skipped') return null

  if (watching) {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-step-running">
        <Spinner />
        {step.verification?.label ?? 'Watching'}
      </span>
    )
  }

  if (state === 'running') {
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-step-running">
        <Spinner />
        {step.runLabel ?? 'Running…'}
      </span>
    )
  }

  if (state === 'awaiting_confirm') {
    // A drafted message is its own control — the editor above posts it.
    if (step.draft) return null
    return (
      <span className="inline-flex items-center gap-2 text-[13px] text-step-confirm">
        <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.9} />
        {step.draft ? 'Drafted — waiting for you to post it' : 'Waiting for your approval above'}
      </span>
    )
  }

  // A step a person has to perform gets a checkbox, not a Run button. The
  // affordance is the claim about who acts.
  if (step.actor !== 'agent' && !step.verification) {
    return (
      <Checkbox
        checked={false}
        disabled={inert}
        onChange={() => onMarkDone?.()}
        label={<span className="text-ink-muted">Mark done once you have made the change</span>}
      />
    )
  }

  if (step.verification) {
    return (
      <Button variant="subtle" className="self-start" disabled={inert} onClick={onStartVerification}>
        {step.verification.mode === 'automatic' ? 'Start watching' : 'Ask to confirm'}
      </Button>
    )
  }

  return (
    <Button
      variant="subtle"
      className="self-start"
      disabled={inert}
      onClick={kind === 'confirm' ? onRequestConfirm : onRun}
    >
      {kind === 'confirm' ? 'Approve and run' : 'Run'}
    </Button>
  )
}

/**
 * What a step offers while the plan is being edited rather than run: drop it,
 * or take the agent's autonomy back. A step that has already run is left
 * alone — editing history is not a thing this app pretends to do.
 */
function EditControls({
  step,
  state,
  requireApproval,
  onSkip,
  onRestore,
  onRequireApproval,
}: {
  step: SuggestionStep
  state: StepRunState
  requireApproval: boolean
  onSkip?: () => void
  onRestore?: () => void
  onRequireApproval?: (value: boolean) => void
}) {
  if (state === 'skipped') {
    return (
      <Button
        variant="subtle"
        className="self-start"
        icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />}
        onClick={onRestore}
      >
        Put this step back
      </Button>
    )
  }

  if (state !== 'pending') {
    return <span className="text-[12px] text-ink-faint">Already under way — not editable.</span>
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line-subtle bg-surface-raised/20 p-2.5">
      {step.automation.kind === 'auto' ? (
        <Checkbox
          checked={requireApproval}
          onChange={(next) => onRequireApproval?.(next)}
          label={
            <span className="text-ink">
              Require my approval before this runs
              <span className="block text-[12px] text-ink-muted">
                The agent stops and asks instead of running it unattended.
              </span>
            </span>
          }
        />
      ) : null}
      <Button
        variant="subtle"
        className="self-start"
        icon={<SkipForward className="h-3.5 w-3.5" strokeWidth={1.75} />}
        onClick={onSkip}
      >
        Drop this step
      </Button>
    </div>
  )
}

function Marker({
  index,
  state,
  blocked,
  watching,
}: {
  index: number
  state: StepRunState
  blocked: boolean
  watching: boolean
}) {
  const base =
    'relative z-10 -ml-[29px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold leading-none'

  if (state === 'done') {
    return (
      <span className={cn(base, 'bg-step-done-soft text-step-done')}>
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    )
  }
  if (state === 'skipped') {
    return (
      <span className={cn(base, 'bg-surface-raised text-ink-faint')}>
        <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    )
  }
  if (state === 'running' || watching) {
    return (
      <span className={cn(base, 'bg-step-running-soft text-step-running')}>
        <Spinner />
      </span>
    )
  }
  if (state === 'awaiting_confirm') {
    return <span className={cn(base, 'bg-step-confirm-soft text-step-confirm')}>{index}</span>
  }
  if (blocked) {
    return (
      <span className={cn(base, 'bg-step-blocked-soft text-step-blocked')}>
        <Lock className="h-3 w-3" strokeWidth={2} />
      </span>
    )
  }
  return <span className={cn(base, 'bg-surface-raised text-ink-muted')}>{index}</span>
}
