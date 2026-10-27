import { Bell, PauseCircle, ShieldAlert } from 'lucide-react'
import type { HoldSpec, SuggestionStep, VerificationCheck } from '@/data/types'
import { Note } from '@/components/ui/Note'
import { Spinner } from '@/components/ui/Spinner'
import { RichText } from '@/components/ui/RichText'

/**
 * Inline confirm. There is no modal pattern in this repo and we are not
 * inventing one — the tradeoff is that an inline gate is less forceful than a
 * dialog, mitigated by naming the blast radius in the copy rather than asking
 * "Are you sure?".
 */
export function ConfirmPanel({ step }: { step: SuggestionStep }) {
  if (step.automation.kind !== 'confirm') return null
  return (
    <div className="flex flex-col gap-2">
      <Note tone="warn" icon={<ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.75} />}>
        <span className="font-medium">What this changes: </span>
        {step.automation.because}
      </Note>
      <p className="text-[12px] leading-snug text-ink-muted">
        Running it will be logged to the activity timeline under the Agent, with the workflow name.
      </p>
    </div>
  )
}

/** Automatic verification in flight — the requester is informed, not interrogated. */
export function VerificationPanel({ check }: { check: VerificationCheck }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-[13px] text-step-running">
        <Spinner />
        {check.label}
      </div>
      <Note tone="muted">{check.followUp}</Note>
    </div>
  )
}

export function VerificationPassed({ check }: { check: VerificationCheck }) {
  return (
    <Note tone="ok">
      <RichText segments={check.passed} />
    </Note>
  )
}

/** Hold state — names what is being waited on and what happens if nothing comes. */
export function HoldPanel({ spec, nudgesSent }: { spec: HoldSpec; nudgesSent: number }) {
  return (
    <div className="flex flex-col gap-2">
      {spec.pausesSla ? (
        <Note tone="muted" icon={<PauseCircle className="h-3.5 w-3.5" strokeWidth={1.75} />}>
          Resolution SLA paused. Requester latency does not score against you.
        </Note>
      ) : null}
      {spec.cadence ? (
        <Note tone="muted" icon={<Bell className="h-3.5 w-3.5" strokeWidth={1.75} />}>
          {spec.cadence}
          {nudgesSent > 0 ? ` ${nudgesSent} sent so far.` : ''}
        </Note>
      ) : null}
    </div>
  )
}
