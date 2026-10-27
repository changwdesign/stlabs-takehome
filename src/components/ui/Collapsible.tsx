import { useState, type ReactNode } from 'react'
import { ChevronUp } from 'lucide-react'
import { cn } from '@/lib/cn'
import { focusRing } from './Button'

/**
 * Uncontrolled by default. Passing `open`/`onOpenChange` hands control to the
 * caller — needed so the "Show similar SSO tickets" chip in the detail can
 * open the cohort section over in the rail.
 */
export function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  trailing,
  pinned,
  children,
  flush = false,
  className,
}: {
  title: string
  icon?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Right-aligned summary shown in the header, visible while collapsed. */
  trailing?: ReactNode
  /** Shown under the header whether or not the section is open. */
  pinned?: ReactNode
  children?: ReactNode
  /** Body runs edge to edge under a rule, for content that brings its own rows. */
  flush?: boolean
  className?: string
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen

  function toggle() {
    const next = !open
    if (controlledOpen === undefined) setUncontrolledOpen(next)
    onOpenChange?.(next)
  }

  return (
    <section className={cn('border-b border-line-subtle last:border-b-0', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-surface-raised/30',
          focusRing,
        )}
      >
        <span className="text-ink-muted">{icon}</span>
        <span className="flex-1 text-[13px] font-medium text-ink">{title}</span>
        {trailing ? <span className="shrink-0 text-[12px] text-ink-muted">{trailing}</span> : null}
        <ChevronUp
          className={cn(
            'h-4 w-4 shrink-0 text-ink-muted transition-transform duration-200',
            !open && 'rotate-180',
          )}
        />
      </button>
      {pinned ? <div className="px-4 pb-3 pl-10">{pinned}</div> : null}
      {open && children ? (
        <div className={flush ? 'border-t border-line-subtle' : 'px-4 pb-4'}>{children}</div>
      ) : null}
    </section>
  )
}
