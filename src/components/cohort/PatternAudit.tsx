import { useState } from 'react'
import { Check, Pencil, RotateCcw, SendHorizontal, SkipForward, Sparkles, X } from 'lucide-react'
import type { ResolutionPattern, SuggestionStep } from '@/data/types'
import { emptyWorkflowDraft, type WorkflowDraft } from '@/state/runs'
import { StepActorTag } from '@/components/ticket/StepActorTag'
import { ScaleBadge } from '@/components/run/RunBadges'
import { Button, IconButton, focusRing } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { TextArea } from '@/components/ui/TextArea'
import { cn } from '@/lib/cn'

export interface WorkflowEdits {
  onRename: (name: string) => void
  onDrop: (stepId: string, value: boolean) => void
  onRequireApproval: (stepId: string, value: boolean) => void
  onAddInstruction: (text: string) => void
  onRemoveInstruction: (id: string) => void
}

/**
 * The workflow the agent proposes from tkt-1's resolution — a suggestion, so
 * it is edited the way the single-ticket plan is: drop a step, or pull one
 * back behind an approval on each ticket. Each step still states its verdict
 * at scale, *before* selection: tkt-1 contains a step Grant did by hand, and
 * that cannot run unattended across the set.
 *
 * Below the steps, the agent takes free-text instructions for the run.
 */
export function PatternAudit({
  pattern,
  steps,
  draft = emptyWorkflowDraft,
  edits,
  locked = false,
  embedded = false,
}: {
  pattern: ResolutionPattern
  /** The source ticket's steps, for labels and actors. */
  steps: SuggestionStep[]
  draft?: WorkflowDraft
  /** Absent renders the workflow read-only. */
  edits?: WorkflowEdits
  /** A run already exists — edits would not reach it. */
  locked?: boolean
  /**
   * Inside a container that supplies the frame and the title (the run page's
   * Workflow section): drops the border and the name line, keeps the rest.
   */
  embedded?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [instruction, setInstruction] = useState('')
  const canEdit = Boolean(edits) && !locked
  const kept = pattern.steps.filter((s) => !draft.dropped[s.stepId])
  const perTicket =
    kept.filter((s) => s.scale === 'per_ticket_input').length +
    kept.filter((s) => draft.requireApproval[s.stepId]).length
  const blocking = kept.filter((s) => s.scale === 'blocks_bulk').length
  const editCount =
    Object.keys(draft.dropped).length +
    Object.keys(draft.requireApproval).length +
    (draft.name && draft.name !== pattern.name ? 1 : 0)

  function addInstruction() {
    if (!instruction.trim()) return
    edits?.onAddInstruction(instruction)
    setInstruction('')
  }

  return (
    <section className="flex flex-col gap-3">
      <div className={cn('flex flex-col overflow-hidden', !embedded && 'rounded-xl border border-line')}>
        {/* Name on a line of its own, so it never truncates in a narrow
            column; the summary and the edit control share the line under it.
            The surrounding page supplies the section heading. */}
        <div className="flex flex-col gap-2 border-b border-line-subtle px-4 py-3">
          {embedded ? null : editing ? (
            <input
              aria-label="Workflow name"
              value={draft.name ?? pattern.name}
              onChange={(event) => edits?.onRename(event.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[14px] font-medium text-ink outline-none focus:border-accent/60"
            />
          ) : (
            <span className="text-[14px] font-medium leading-snug text-ink">
              {draft.name || pattern.name}
            </span>
          )}
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 text-[12px] text-ink-faint">
              {kept.length} of {pattern.steps.length} steps ·{' '}
              {blocking
                ? `${blocking} blocks bulk`
                : perTicket
                  ? `${perTicket} need${perTicket === 1 ? 's' : ''} you per ticket`
                  : 'all run at scale'}
              {editCount ? <span className="text-accent"> · {editCount} edited</span> : null}
            </span>
            {/* Direct edits are a plain control on the workflow itself; the
                sparkle is kept for the one thing that talks to the agent — the
                instruction box below. */}
            {canEdit ? (
              <Button
                variant="subtle"
                className="shrink-0 px-2 py-1"
                aria-pressed={editing}
                icon={editing ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />}
                onClick={() => setEditing((open) => !open)}
              >
                {editing ? 'Done' : 'Edit steps'}
              </Button>
            ) : null}
          </div>
        </div>

        <ol className="flex flex-col divide-y divide-line-subtle">
          {pattern.steps.map((audit, i) => {
            const step = steps.find((s) => s.id === audit.stepId)
            if (!step) return null
            const dropped = Boolean(draft.dropped[step.id])
            const pulledBack = Boolean(draft.requireApproval[step.id])
            const automation = pulledBack && step.automation.kind !== 'manual' ? 'confirm' : step.automation.kind
            return (
              // Stacked, not side by side: title, then who/at-scale, then why,
              // then edits. Reads the same at the panel's column width as on a
              // full page, and nothing wraps into a stray line of its own.
              <li key={audit.stepId} className={cn('flex gap-3 px-4 py-3', dropped && 'bg-surface-raised/10')}>
                <span className="mt-0.5 w-4 shrink-0 text-[12px] font-semibold text-ink-faint">{i + 1}</span>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className={cn('flex flex-col gap-1.5', dropped && 'opacity-60')}>
                    <span
                      className={cn(
                        'text-[14px] font-medium leading-5 text-ink',
                        dropped && 'text-ink-muted line-through decoration-ink-muted',
                      )}
                    >
                      {step.label}
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StepActorTag actor={step.actor} automation={automation} />
                      {dropped ? (
                        <span className="rounded-md bg-surface-pill px-1.5 py-0.5 text-[11px] font-medium leading-none text-ink-muted">
                          Dropped
                        </span>
                      ) : pulledBack ? (
                        <ScaleBadge verdict="per_ticket_input" />
                      ) : (
                        <ScaleBadge verdict={audit.scale} />
                      )}
                    </div>
                    <p className="text-[12px] leading-snug text-ink-muted">
                      {dropped
                        ? 'Skipped on every ticket in the run.'
                        : pulledBack
                          ? 'You approve this on each ticket — the batch confirm no longer covers it.'
                          : audit.note}
                    </p>
                  </div>

                  {editing ? (
                    <StepEdit
                      step={step}
                      dropped={dropped}
                      pulledBack={pulledBack}
                      onDrop={(value) => edits?.onDrop(step.id, value)}
                      onRequireApproval={(value) => edits?.onRequireApproval(step.id, value)}
                    />
                  ) : null}
                </div>
              </li>
            )
          })}
        </ol>

        {/* The agent takes instructions for the run, in its own voice: same
            sparkle as the plan's agent chips. Read-only with none given, there
            is nothing to show, so the strip goes. */}
        {canEdit || draft.instructions.length ? (
          <div className="flex flex-col gap-2.5 border-t border-line-subtle bg-surface-raised/10 px-4 py-3">
            {draft.instructions.length ? (
              <ul className="flex flex-col gap-1.5">
                {draft.instructions.map((item) => (
                  <li key={item.id} className="flex items-start gap-2 text-[13px] text-ink">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={1.75} />
                    <span className="min-w-0 flex-1 whitespace-pre-wrap">{item.text}</span>
                    {canEdit ? (
                      <IconButton
                        label="Remove instruction"
                        className="h-5 w-5"
                        onClick={() => edits?.onRemoveInstruction(item.id)}
                      >
                        <X className="h-3 w-3" strokeWidth={2} />
                      </IconButton>
                    ) : null}
                  </li>
                ))}
                <li className="pl-5 text-[12px] text-ink-muted">
                  The agent follows {draft.instructions.length === 1 ? 'this' : 'these'} on every ticket in
                  the run and logs it on each one.
                </li>
              </ul>
            ) : null}

            {/* One shared centre line: icon, single-row field and send button
                all sit on it, rather than each nudged by its own margin. */}
            {canEdit ? (
              <div className="flex items-center gap-2 rounded-lg border border-line bg-canvas py-1 pl-3 pr-1 focus-within:border-accent/50">
                <Sparkles className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.75} />
                <TextArea
                  rows={1}
                  aria-label="Instructions for the agent"
                  placeholder="Tell the agent how to apply this at scale…"
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      addInstruction()
                    }
                  }}
                  className="block py-1 text-[13px] leading-5"
                />
                <IconButton
                  label="Add instruction"
                  className="h-7 w-7 shrink-0"
                  disabled={!instruction.trim()}
                  onClick={addInstruction}
                >
                  <SendHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />
                </IconButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {locked ? (
        <span className="text-[12px] text-ink-faint">
          A run already exists for this workflow, so it is read-only here.
        </span>
      ) : null}
    </section>
  )
}

function StepEdit({
  step,
  dropped,
  pulledBack,
  onDrop,
  onRequireApproval,
}: {
  step: SuggestionStep
  dropped: boolean
  pulledBack: boolean
  onDrop: (value: boolean) => void
  onRequireApproval: (value: boolean) => void
}) {
  if (dropped) {
    return (
      <Button
        variant="subtle"
        className="self-start"
        icon={<RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />}
        onClick={() => onDrop(false)}
      >
        Put back
      </Button>
    )
  }
  // Nothing in a run reaches Resolved unverified, so the check stays.
  if (step.verification) {
    return (
      <span className="text-[12px] leading-snug text-ink-faint">
        Verification stays — nothing resolves unverified.
      </span>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-line-subtle bg-surface-raised/20 px-2.5 py-2">
      {step.actor === 'agent' ? (
        <Checkbox
          checked={pulledBack}
          onChange={onRequireApproval}
          label={<span className="text-[12px] text-ink">Approve on each ticket</span>}
        />
      ) : null}
      <button
        type="button"
        onClick={() => onDrop(true)}
        className={cn(
          'inline-flex items-center gap-1.5 self-start rounded text-[12px] text-ink-muted transition-colors hover:text-ink',
          focusRing,
        )}
      >
        <SkipForward className="h-3.5 w-3.5" strokeWidth={1.75} />
        Drop from workflow
      </button>
    </div>
  )
}
