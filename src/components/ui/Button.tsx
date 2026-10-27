import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Spinner } from './Spinner'

type Variant = 'primary' | 'ghost' | 'subtle' | 'tab' | 'tabActive'

const variants: Record<Variant, string> = {
  primary: 'bg-accent-btn text-ink hover:bg-accent-btn-hover',
  ghost: 'text-ink-muted hover:bg-surface-raised hover:text-ink',
  subtle: 'bg-surface-pill text-ink-muted hover:bg-surface-raised hover:text-ink',
  tab: 'bg-surface-pill-alt text-ink hover:bg-surface-raised',
  tabActive: 'bg-accent-soft text-accent',
}

/** Shared focus treatment — the prototype previously had no focus rings at all. */
export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  icon?: ReactNode
  /** Swaps the icon for a spinner and blocks the click. */
  busy?: boolean
}

export function Button({
  variant = 'ghost',
  icon,
  busy = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium leading-none transition-colors',
        focusRing,
        variants[variant],
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  )
}

export function IconButton({
  className,
  children,
  label,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-raised hover:text-ink',
        focusRing,
        'disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

/** Primary action with an attached dropdown arrow, as on the Post button. */
export function SplitButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <div className={cn('inline-flex overflow-hidden rounded-lg', disabled && 'opacity-40')}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          'bg-accent-btn px-4 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-accent-btn-hover disabled:pointer-events-none',
          focusRing,
        )}
      >
        {children}
      </button>
      <span className="w-px bg-canvas/40" />
      <button
        type="button"
        aria-label="Post options"
        disabled={disabled}
        className={cn(
          'bg-accent-btn px-1.5 text-ink transition-colors hover:bg-accent-btn-hover disabled:pointer-events-none',
          focusRing,
        )}
      >
        <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  )
}
