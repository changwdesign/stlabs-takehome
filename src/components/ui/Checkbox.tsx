import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Used wherever the human is the actor: a step only a person can perform gets
 * a checkbox, never a Run button. The affordance is the claim about who acts.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'group inline-flex items-start gap-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas rounded-md',
        disabled ? 'cursor-not-allowed opacity-50' : 'hover:text-ink',
        className,
      )}
    >
      <span
        className={cn(
          'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors',
          checked
            ? 'border-step-done bg-step-done-soft text-step-done'
            : 'border-line bg-canvas text-transparent group-hover:border-ink-faint',
        )}
      >
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
      <span className="min-w-0 text-[13px] leading-[18px]">{label}</span>
    </button>
  )
}
