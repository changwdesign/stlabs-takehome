import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Label-above-control pairing for form surfaces (the resolve capture form). */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-2">
        <span className="text-[12px] font-medium leading-none text-ink-muted">{label}</span>
        {hint ? <span className="text-[12px] leading-none text-ink-faint">{hint}</span> : null}
      </div>
      {children}
    </div>
  )
}

/** Read-only value, for figures the prototype authors rather than computes. */
export function ReadOnlyValue({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-line-subtle bg-surface-raised/30 px-2.5 py-1.5 text-[13px] leading-none text-ink">
      {children}
    </span>
  )
}
