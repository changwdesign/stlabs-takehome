import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
  /** Rendered under the control once selected — what choosing this costs. */
  hint?: string
}

/**
 * Mutually-exclusive choice where every option stays visible. Used for the
 * composer's three modes: options with different consequences should not be
 * hidden behind a menu you have to open to discover.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fill = false,
  className,
}: {
  options: ReadonlyArray<SegmentedOption<T>>
  value: T
  onChange: (value: T) => void
  label: string
  /**
   * Options share the full width of the container instead of hugging their
   * labels. For a control that sits in a column of its own — a track wider
   * than its buttons reads as a bug, not as breathing room.
   */
  fill?: boolean
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-surface-pill-alt p-0.5',
        // Otherwise a column parent stretches the track and leaves the
        // buttons bunched at its left edge.
        fill ? 'flex w-full' : 'self-start',
        className,
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5 text-[13px] leading-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60',
              fill && 'flex-1 justify-center',
              active
                ? 'bg-accent-soft text-accent'
                : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
