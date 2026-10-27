import { Check } from 'lucide-react'
import type { ResolutionDraft, ResolutionRecord, Ticket } from '@/data/types'
import { resolutionCauses } from '@/data/resolutions'
import { getWorkflow } from '@/data/workflows'
import { cohortView, type Expectation } from '@/state/selectors'
import { Button, focusRing } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, ReadOnlyValue } from '@/components/ui/Field'
import { Note } from '@/components/ui/Note'
import { TextArea } from '@/components/ui/TextArea'
import { cn } from '@/lib/cn'

/**
 * Resolve is a capture step, not a status toggle. What it collects is the
 * input to the bulk suggestion — which is why the cause comes from a closed
 * list: free text cannot be matched against another ticket.
 *
 * Expands in place inside the next-action region, so the capture appears
 * where the primary action already was. No modal, no scroll hunt.
 */
export function ResolveForm({
  ticket,
  expectation,
  draft,
  likelyCauseId,
  ranWorkflowIds,
  onPatch,
  onSubmit,
  onCancel,
}: {
  ticket: Ticket
  /** Actual-vs-target, scored against the target in force rather than the fixture's. */
  expectation?: Expectation
  draft: ResolutionDraft
  likelyCauseId?: string
  ranWorkflowIds: string[]
  onPatch: (patch: Partial<ResolutionDraft>) => void
  onSubmit: () => void
  onCancel: () => void
}) {
  const view = cohortView(ticket)
  const expected = expectation ?? ticket.expected

  return (
    <div className="flex flex-col gap-5">
      <Field label="Cause" hint="pre-selected from the agent’s diagnosis">
        <div className="flex flex-col gap-1.5">
          {resolutionCauses.map((cause) => {
            const selected = draft.causeId === cause.id
            return (
              <button
                key={cause.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onPatch({ causeId: cause.id })}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors',
                  focusRing,
                  selected
                    ? 'border-accent/50 bg-accent-soft/40'
                    : 'border-line-subtle bg-canvas hover:border-line',
                )}
              >
                <span
                  className={cn(
                    'mt-[3px] flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-full border',
                    selected ? 'border-accent bg-accent text-canvas' : 'border-line',
                  )}
                >
                  {selected ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink">
                    {cause.label}
                    {cause.id === likelyCauseId ? (
                      <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
                        Agent’s diagnosis
                      </span>
                    ) : null}
                  </span>
                  {cause.detail ? (
                    <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                      {cause.detail}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </Field>

      {/* Only where workflows actually ran. A first-time fix done step by
          step has none — the workflow is what this resolution becomes. */}
      {ranWorkflowIds.length > 0 ? (
        <Field label="Workflows that ran" hint="pre-checked from this ticket’s execution">
          <div className="flex flex-col gap-2">
            {ranWorkflowIds.map((id) => {
              const workflow = getWorkflow(id)
              const checked = draft.workflowIds.includes(id)
              return (
                <Checkbox
                  key={id}
                  checked={checked}
                  onChange={(next) =>
                    onPatch({
                      workflowIds: next
                        ? [...draft.workflowIds, id]
                        : draft.workflowIds.filter((w) => w !== id),
                    })
                  }
                  label={<span className="text-ink">{workflow?.name ?? id}</span>}
                />
              )
            })}
          </div>
        </Field>
      ) : null}

      {expected ? (
        <div className="flex flex-wrap gap-6">
          <Field label="Time to resolve">
            <ReadOnlyValue>{expected.timeToResolve}</ReadOnlyValue>
          </Field>
          <Field
            label="Against target"
            hint={
              expectation?.policyTarget
                ? `re-cut from the ${expectation.policyTarget} policy row`
                : undefined
            }
          >
            <ReadOnlyValue>
              <span className={expected.withinTarget ? 'text-step-done' : 'text-danger'}>
                {expected.withinTarget ? 'Within' : 'Over'} {expected.target}
              </span>
            </ReadOnlyValue>
          </Field>
        </div>
      ) : null}

      <Field label="Note" hint="optional — what the next person needs to know">
        <div className="rounded-xl border border-line-subtle bg-canvas p-3">
          <TextArea
            rows={3}
            value={draft.note}
            placeholder="Anything the cohort fix should carry over…"
            onChange={(event) => onPatch({ note: event.target.value })}
          />
        </div>
      </Field>

      {view ? (
        <Checkbox
          checked={draft.notifyCohort}
          onChange={(next) => onPatch({ notifyCohort: next })}
          label={
            <span className="text-ink">
              Notify the {view.cohort?.notYetAffected} people in this rollout who have not filed yet
              <span className="block text-[12px] text-ink-muted">
                Preventive action is an outcome, not a footnote — tell them before they file.
              </span>
            </span>
          }
        />
      ) : null}

      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={onSubmit} disabled={!draft.causeId}>
          Resolve ticket
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Not yet
        </Button>
      </div>
    </div>
  )
}

/** What the card collapses to once the capture is submitted. */
export function ResolutionSummary({
  resolution,
  cohortSize,
  notYetAffected,
}: {
  resolution: ResolutionRecord
  cohortSize?: number
  notYetAffected?: number
}) {
  return (
    <div className="flex flex-col gap-3">
      <dl className="flex flex-col gap-2.5">
        <SummaryRow label="Cause">{resolution.causeLabel}</SummaryRow>
        <SummaryRow label="Time to resolve">
          {resolution.timeToResolve}{' '}
          <span className={resolution.withinTarget ? 'text-step-done' : 'text-danger'}>
            ({resolution.withinTarget ? 'within' : 'over'} the {resolution.target} target)
          </span>
        </SummaryRow>
        {resolution.workflowIds.length ? (
          <SummaryRow label="Workflows">
            {resolution.workflowIds.map((id) => getWorkflow(id)?.name ?? id).join(', ')}
          </SummaryRow>
        ) : null}
        {resolution.note ? <SummaryRow label="Note">{resolution.note}</SummaryRow> : null}
      </dl>

      {resolution.notifyCohort && notYetAffected ? (
        <Note tone="ok">
          Pre-emptive notice queued for {notYetAffected} people who have not filed yet.
        </Note>
      ) : null}

      {cohortSize && cohortSize > 1 ? (
        <Note tone="muted">
          This resolution is now available to the other {cohortSize - 1} tickets in the cohort — see
          the rail.
        </Note>
      ) : null}
    </div>
  )
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] leading-none text-ink-muted">{label}</dt>
      <dd className="text-[14px] leading-snug text-ink">{children}</dd>
    </div>
  )
}
