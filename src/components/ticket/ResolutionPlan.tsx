import { Sparkles } from 'lucide-react'
import type { Automation, Suggestion, SuggestionChip, SuggestionStep, Ticket } from '@/data/types'
import type { StepDraftState, StepRunState, TicketSession } from '@/state/types'
import { automationFor, blockerOf, isBlocked, planProgress } from '@/state/selectors'
import { getUser } from '@/data/users'
import { StepProgress } from '@/components/ui/StepProgress'
import { CollapsibleSection } from '@/components/ui/Collapsible'
import { Note } from '@/components/ui/Note'
import { focusRing } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { StepRow } from './StepRow'

export interface PlanRow {
  step: SuggestionStep
  state: StepRunState
  blocked: boolean
  blockedBy?: string
  watching: boolean
  /** Autonomy in force, which an edit can pull back from the fixture's grant. */
  automation: Automation
  draft?: StepDraftState
  draftTo?: string
}

/* ---------------- pure view ---------------- */

export function ResolutionPlanView({
  suggestion,
  rows,
  started,
  embedded = false,
  editing = false,
  onRun,
  onRequestConfirm,
  onMarkDone,
  onStartVerification,
  onChip,
  onToggleEdit,
  onSkip,
  onRestore,
  onRequireApproval,
  onDraftChange,
  onResetDraft,
  onPostDraft,
}: {
  suggestion: Suggestion
  rows: PlanRow[]
  started: boolean
  /** Rendered inside the next-action window: no card of its own, no second border. */
  embedded?: boolean
  /** Plan-edit mode: steps offer edits instead of run controls. */
  editing?: boolean
  onRun?: (stepId: string) => void
  onRequestConfirm?: (stepId: string) => void
  onMarkDone?: (stepId: string) => void
  onStartVerification?: (checkId: string) => void
  onChip?: (chip: SuggestionChip) => void
  onToggleEdit?: () => void
  onSkip?: (stepId: string) => void
  onRestore?: (stepId: string) => void
  onRequireApproval?: (stepId: string, value: boolean) => void
  onDraftChange?: (stepId: string, patch: Partial<Pick<StepDraftState, 'body' | 'attachments'>>) => void
  onResetDraft?: (stepId: string) => void
  onPostDraft?: (stepId: string) => void
}) {
  const done = rows.filter((row) => row.state === 'done' || row.state === 'skipped').length
  const complete = rows.length > 0 && done === rows.length

  // Once everything is done the plan stops competing with the capture form
  // at the top of the page and collapses to its own summary line.
  if (complete) {
    const collapsed = (
      <CollapsibleSection
        title={suggestion.title}
        defaultOpen={false}
        trailing={`${done} of ${rows.length} complete`}
        className={embedded ? '-m-5 border-b-0' : undefined}
      >
        <ol className="flex flex-col gap-6 pl-3 pt-1">
          {rows.map((row, i) => (
            <StepRow key={row.step.id} step={row.step} index={i + 1} state={row.state} />
          ))}
        </ol>
      </CollapsibleSection>
    )

    if (embedded) return collapsed

    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-[13px] text-ink-muted">Resolution plan</h2>
        <div className="overflow-hidden rounded-xl border border-line bg-canvas">{collapsed}</div>
      </section>
    )
  }

  const body = (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] text-ink-muted">Resolution plan</h2>
        {started ? <StepProgress done={done} total={rows.length} /> : null}
      </div>

      {/* Same rule as the action half above it — the two paragraphs share a window. */}
      <p className="text-[15px] leading-relaxed text-ink">
        {suggestion.lede}
      </p>

      {/* Embedded, the window's own border is the card — a second one here
          would box the steps twice. */}
      <div className={cn(embedded ? 'pt-1' : 'rounded-xl border border-line bg-canvas p-5')}>
        <h3 className="text-[15px] font-semibold text-ink">{suggestion.title}</h3>

        {!started ? (
          <Note tone="muted" className="mt-3">
            The plan is read-only until you start work — nothing runs behind your back.
          </Note>
        ) : null}

        {editing ? (
          <Note tone="warn" className="mt-3">
            The plan is the agent’s suggestion, not an instruction to you. Drop a step you do
            not want, or take back a grant so the agent has to ask first.
          </Note>
        ) : null}

        {/* Not dimmed before work starts: reviewing the plan is the point of
            showing it, and dependency locks are a run-time concern. */}
        <ol className="mt-4 flex flex-col gap-6 pl-3">
          {rows.map((row, i) => (
            <StepRow
              key={row.step.id}
              step={row.step}
              index={i + 1}
              state={row.state}
              blocked={started && row.blocked}
              blockedBy={started ? row.blockedBy : undefined}
              watching={row.watching}
              readOnly={!started}
              automation={row.automation}
              editing={editing}
              onRun={() => onRun?.(row.step.id)}
              onRequestConfirm={() => onRequestConfirm?.(row.step.id)}
              onMarkDone={() => onMarkDone?.(row.step.id)}
              onStartVerification={() =>
                row.step.verification && onStartVerification?.(row.step.verification.id)
              }
              onSkip={() => onSkip?.(row.step.id)}
              onRestore={() => onRestore?.(row.step.id)}
              onRequireApproval={(value) => onRequireApproval?.(row.step.id, value)}
              draft={row.draft}
              draftTo={row.draftTo}
              onDraftChange={(patch) => onDraftChange?.(row.step.id, patch)}
              onResetDraft={() => onResetDraft?.(row.step.id)}
              onPostDraft={() => onPostDraft?.(row.step.id)}
            />
          ))}
        </ol>
      </div>

      <AgentChips
        chips={suggestion.chips}
        onChip={onChip}
        editing={editing}
        onToggleEdit={onToggleEdit}
      />
    </>
  )

  return <section className="flex flex-col gap-3">{body}</section>
}

/**
 * Quick replies to the agent. Modifying the plan sits first and reads as one
 * of them — it is still the agent's plan being reshaped — and stays in the
 * accent tone while editing so the mode is visible.
 */
export function AgentChips({
  chips,
  onChip,
  editing = false,
  onToggleEdit,
}: {
  chips: SuggestionChip[]
  onChip?: (chip: SuggestionChip) => void
  editing?: boolean
  onToggleEdit?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-5 pt-1">
      {onToggleEdit ? (
        <AgentChip onClick={onToggleEdit} active={editing} pressed={editing}>
          {editing ? 'Done modifying' : 'Modify plan'}
        </AgentChip>
      ) : null}
      {chips.map((chip) => (
        <AgentChip key={chip.label} onClick={() => onChip?.(chip)} muted={chip.act === 'none'}>
          {chip.label}
        </AgentChip>
      ))}
    </div>
  )
}

export function AgentChip({
  children,
  onClick,
  muted = false,
  active = false,
  pressed,
}: {
  children: React.ReactNode
  onClick: () => void
  muted?: boolean
  active?: boolean
  pressed?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={cn(
        'inline-flex items-center gap-2 rounded-md text-[13px] text-ink transition-opacity hover:opacity-70',
        focusRing,
        muted && 'text-ink-muted',
        active && 'text-accent',
      )}
    >
      <Sparkles className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
      {children}
    </button>
  )
}

/* ---------------- container ---------------- */

export function planRows(ticket: Ticket, session: TicketSession): PlanRow[] {
  return (ticket.suggestion?.steps ?? []).map((step) => {
    const blocked = isBlocked(step, session)
    return {
      step,
      state: session.steps[step.id] ?? 'pending',
      blocked,
      automation: automationFor(step, session),
      blockedBy: blocked ? blockerOf(step, session, ticket)?.label : undefined,
      watching:
        session.verify?.state === 'watching' && session.verify.checkId === step.verification?.id,
      draft: session.stepDrafts[step.id],
      draftTo: step.draft ? getUser(ticket.requesterId).name : undefined,
    }
  })
}

export { planProgress }
