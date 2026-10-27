import type { ReactNode } from 'react'
import { Scale } from 'lucide-react'
import type { SlaPolicy } from '@/data/types'
import type { SessionAction, TicketSession } from '@/state/types'
import type { SlaChange, SlaView } from '@/state/selectors'
import { Button, focusRing } from '@/components/ui/Button'
import { SlaBadge } from '@/components/ui/badges'
import { Note } from '@/components/ui/Note'
import { Segmented } from '@/components/ui/Segmented'
import { cn } from '@/lib/cn'

/**
 * Review-and-change for the ticket's targets, in the two places the question
 * actually comes up: when Grant accepts the ticket, and in the rail once he
 * already owns it.
 *
 * Three things are kept visible at once, because any one alone is misleading:
 * the clock as it reads now, the **policy row** the target came from, and the
 * agent's **suggestion** where it disagrees with that row. A target is picked
 * from a closed list and a change has to cite a reason — a commitment nobody
 * can audit is not a commitment.
 */
export function SlaReview({
  policy,
  rows,
  draft,
  changes,
  onAct,
  footer,
}: {
  policy: SlaPolicy
  rows: SlaView[]
  draft: TicketSession['slaDraft']
  changes: SlaChange[]
  onAct: (action: SessionAction) => void
  /** Commit controls, when this isn't riding on the card's own primary. */
  footer?: ReactNode
}) {
  const changed = changes.length > 0

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line-subtle bg-canvas p-4">
      <div className="flex items-start gap-2">
        <Scale className="mt-[2px] h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[13px] font-medium text-ink">
            Referenced from {policy.label}
          </span>
          <span className="text-[12px] leading-snug text-ink-muted">{policy.basis}</span>
        </div>
      </div>

      {/* Two clocks, side by side where there is room — they are read as a
          pair. Container query, not a viewport one: the same component also
          renders in the 360px rail, where the pair has to stack. */}
      <div className="@container">
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 @md:grid-cols-2">
          {rows.map((row) => {
            const options = policy.options[row.label]
            if (!options) return null
            const current = row.target
            const value = draft.targets[row.label] ?? current ?? options[0]
            const suggestion =
              policy.suggestion?.slaLabel === row.label ? policy.suggestion : undefined

            return (
              <div key={row.label} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-medium text-ink">{row.label}</span>
                  <SlaBadge value={row.value} state={row.state} />
                  <span className="text-[11px] text-ink-faint">
                    policy {row.policyTarget ?? '—'}
                    {value !== current ? (
                      <span className="text-accent"> · changing {current} → {value}</span>
                    ) : row.overridden ? (
                      <span className="text-ink-muted"> · in force {current}</span>
                    ) : null}
                  </span>
                </div>

                <Segmented
                  fill
                  label={`${row.label} target`}
                  options={options.map((option) => ({ value: option, label: option }))}
                  value={value}
                  onChange={(target) => onAct({ type: 'SET_SLA_TARGET', slaLabel: row.label, target })}
                />

                {suggestion ? (
                  value === suggestion.target ? (
                    <Note tone="ok">
                      Using the agent’s suggested {suggestion.target}. {suggestion.because}
                    </Note>
                  ) : (
                    <Note tone="muted">
                      <span className="block">
                        The agent suggests <span className="text-ink">{suggestion.target}</span> —{' '}
                        {suggestion.because}
                      </span>
                      <Button
                        variant="subtle"
                        className="mt-2"
                        onClick={() =>
                          onAct({
                            type: 'SET_SLA_TARGET',
                            slaLabel: row.label,
                            target: suggestion.target,
                          })
                        }
                      >
                        Use {suggestion.target}
                      </Button>
                    </Note>
                  )
                ) : null}

                {row.state === 'breached' && value !== current ? (
                  <Note tone="warn">
                    This clock is already breached at {row.value}. Re-cutting the target applies
                    from here — it does not undo the breach.
                  </Note>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {changed ? (
        <div className="flex flex-col gap-2 border-t border-line-subtle pt-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium leading-none text-ink-muted">Why</span>
            <span className="text-[12px] leading-none text-ink-faint">
              required — it is written to the activity log
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {policy.reasons.map((reason) => {
              const selected = draft.reason === reason
              return (
                <button
                  key={reason}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onAct({ type: 'SET_SLA_REASON', reason })}
                  className={cn(
                    'rounded-lg border px-2.5 py-1.5 text-left text-[12px] leading-snug transition-colors',
                    focusRing,
                    selected
                      ? 'border-accent/50 bg-accent-soft/40 text-ink'
                      : 'border-line-subtle text-ink-muted hover:border-line hover:text-ink',
                  )}
                >
                  {reason}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {footer ? <div className="flex items-center gap-2">{footer}</div> : null}
    </div>
  )
}
