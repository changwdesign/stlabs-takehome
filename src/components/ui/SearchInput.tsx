import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Stays uncontrolled when `value`/`onChange` are omitted, so the existing
 * decorative usages keep working untouched.
 */
export function SearchInput({
  placeholder,
  trailing,
  className,
  size = 'md',
  value,
  onChange,
  autoFocus,
}: {
  placeholder: string
  trailing?: string
  className?: string
  size?: 'md' | 'lg'
  value?: string
  onChange?: (value: string) => void
  autoFocus?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-xl border border-line-subtle bg-canvas transition-colors focus-within:border-line',
        size === 'lg' ? 'px-4 py-3.5' : 'px-3 py-2',
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
      <input
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-muted"
        placeholder={placeholder}
        autoFocus={autoFocus}
        {...(onChange
          ? { value: value ?? '', onChange: (e) => onChange(e.target.value) }
          : { defaultValue: value })}
      />
      {trailing ? <span className="shrink-0 text-[12px] text-ink-muted">{trailing}</span> : null}
    </div>
  )
}
