import { cn } from '@/lib/cn'

/** "3 of 5 complete" plus a bar. Collapsed plan state leans on this. */
export function StepProgress({
  done,
  total,
  className,
}: {
  done: number
  total: number
  className?: string
}) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <span
        className="h-1 w-[72px] shrink-0 overflow-hidden rounded-full bg-surface-raised"
        role="progressbar"
        aria-valuenow={done}
        aria-valuemin={0}
        aria-valuemax={total}
      >
        <span
          className={cn(
            'block h-full rounded-full transition-all duration-500',
            done === total ? 'bg-step-done' : 'bg-step-running',
          )}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="text-[12px] leading-none text-ink-muted">
        {done} of {total} complete
      </span>
    </div>
  )
}
