import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Info, Lock, TriangleAlert, Check } from 'lucide-react'

export type NoteTone = 'muted' | 'locked' | 'ok' | 'warn'

const tones: Record<NoteTone, { wrap: string; icon: ReactNode }> = {
  muted: {
    wrap: 'border-line-subtle bg-surface-raised/30 text-ink-muted',
    icon: <Info className="h-3.5 w-3.5" strokeWidth={1.75} />,
  },
  locked: {
    wrap: 'border-line-subtle bg-surface-raised/20 text-lock',
    icon: <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />,
  },
  ok: {
    wrap: 'border-step-done/25 bg-step-done-soft/50 text-step-done',
    icon: <Check className="h-3.5 w-3.5" strokeWidth={2} />,
  },
  warn: {
    wrap: 'border-step-confirm/30 bg-step-confirm-soft/60 text-step-confirm',
    icon: <TriangleAlert className="h-3.5 w-3.5" strokeWidth={1.75} />,
  },
}

/**
 * One inline explanation component in four tones, instead of five ad-hoc
 * divs. Every autonomy grant, lock and gate in this prototype explains
 * itself, so this gets used a lot.
 */
export function Note({
  tone = 'muted',
  children,
  icon,
  className,
}: {
  tone?: NoteTone
  children: ReactNode
  /** Pass `false`-y to drop the leading glyph. */
  icon?: ReactNode | null
  className?: string
}) {
  const style = tones[tone]
  const glyph = icon === undefined ? style.icon : icon
  return (
    <div
      className={cn(
        'flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[12px] leading-snug',
        style.wrap,
        className,
      )}
    >
      {glyph ? <span className="mt-[1px] shrink-0">{glyph}</span> : null}
      <span className="min-w-0">{children}</span>
    </div>
  )
}
