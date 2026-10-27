import type { ReactNode } from 'react'
import type { ResolutionRecord } from '@/data/types'
import { cn } from '@/lib/cn'

/**
 * Where the workflow came from, said once in plain text: the ticket it was
 * built from, how that fix went, and the cause. The cohort panel and the run
 * page use the same sentence, so the two steps of bulk read as one thread.
 */
export function WorkflowProvenance({
  sourceKey,
  resolution,
  causeLabel,
  className,
}: {
  /** Rendered as given — plain text in the panel, a link on the run page. */
  sourceKey: ReactNode
  resolution?: Pick<ResolutionRecord, 'timeToResolve' | 'withinTarget' | 'target'>
  causeLabel?: string
  className?: string
}) {
  return (
    <p className={cn('text-[13px] leading-snug text-ink-muted', className)}>
      From <span className="font-mono text-ink">{sourceKey}</span>
      {resolution
        ? ` — resolved in ${resolution.timeToResolve}, ${resolution.withinTarget ? 'within' : 'over'} the ${resolution.target} target`
        : ''}
      {causeLabel ? (
        <>
          . Cause: <span className="text-ink">{causeLabel}</span>.
        </>
      ) : (
        '.'
      )}
    </p>
  )
}
