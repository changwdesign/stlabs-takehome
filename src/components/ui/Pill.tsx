import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { focusRing } from './Button'

/**
 * The dropdown-looking pill used across the meta bar. `interactive` adds the
 * caret; without it the pill is a static display chip (e.g. Requester).
 *
 * Leading marks are sized and inset optically, not by box. Round marks — a
 * 20px avatar, the 16px status ring — sit concentric with the 28px capsule
 * (equal gap on the left and above/below). Line icons are 16px and sit 8px
 * in, since their corners would crowd the curve.
 */
const leadInset = {
  avatar: 'pl-1', // (28 - 20) / 2
  ring: 'pl-1.5', // (28 - 16) / 2
  glyph: 'pl-2',
} as const

export type PillLead = keyof typeof leadInset

export function Pill({
  children,
  icon,
  interactive = true,
  className,
  onClick,
  expanded,
  lead = 'glyph',
}: {
  children: ReactNode
  icon?: ReactNode
  /** What `icon` is, which decides the left inset. */
  lead?: PillLead
  interactive?: boolean
  className?: string
  onClick?: () => void
  /** Set when the pill toggles a disclosure (e.g. the requester card). */
  expanded?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full text-[13px] leading-none transition-colors',
        focusRing,
        // Matches the source design: an outlined capsule with no fill, so the
        // meta bar reads as a row of quiet selectors rather than buttons.
        interactive
          ? 'pr-2 text-ink ring-1 ring-inset ring-line hover:bg-surface-raised/40 hover:ring-ink-faint/40'
          : 'pr-1 text-ink',
        leadInset[lead],
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
      {/* -ml-0.5 tightens the label→caret gap to 4px: the caret's box is mostly air */}
      {interactive ? <ChevronDown className="-ml-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" /> : null}
    </button>
  )
}

/** Label-above-control grouping used by the ticket meta bar. */
export function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="px-0.5 text-[12px] leading-none text-ink-muted">{label}</span>
      {children}
    </div>
  )
}
