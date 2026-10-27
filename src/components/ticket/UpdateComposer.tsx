import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Eye, Lock, Paperclip, StickyNote } from 'lucide-react'
import type { ComposerMode } from '@/data/types'
import { Button, IconButton, SplitButton, focusRing } from '@/components/ui/Button'
import { Note } from '@/components/ui/Note'
import { TextArea } from '@/components/ui/TextArea'
import { cn } from '@/lib/cn'

/**
 * Long-form updates are written here. Quick back-and-forth with the requester
 * lives in the rail's Slack thread, which also opens the thread in Slack itself.
 *
 * Matches the source design: one visibility pill ("Everyone") beside the
 * attach button. The three modes live behind it, each with its consequence
 * spelled out in the menu, so the composer stays quiet until it is needed.
 */
const modes: ReadonlyArray<{ value: ComposerMode; label: string; icon: typeof Eye; consequence: string }> = [
  {
    value: 'public',
    label: 'Everyone',
    icon: Eye,
    consequence: 'Goes to the requester and mirrors to the Slack thread this ticket came from.',
  },
  {
    value: 'internal',
    label: 'Internal note',
    icon: StickyNote,
    consequence: 'Visible to the queue only. The requester is not notified.',
  },
  {
    value: 'secure',
    label: 'Secure send',
    icon: Lock,
    consequence: 'Sends a 1Password share link instead of the text. Expires after first open.',
  },
]

/* ---------------- pure view ---------------- */

export function ComposerView({
  mode = 'public',
  body = '',
  fromAgent = false,
  onModeChange,
  onBodyChange,
  onPost,
  embedded = false,
  placeholder = 'Write an update...',
  submitLabel = 'Post',
  hint,
}: {
  mode?: ComposerMode
  body?: string
  fromAgent?: boolean
  onModeChange?: (mode: ComposerMode) => void
  onBodyChange?: (body: string) => void
  onPost?: () => void
  /** Drops the card chrome when a parent block (Activity) supplies it. */
  embedded?: boolean
  placeholder?: string
  submitLabel?: string
  /**
   * Stands in for the visibility pill where there is no choice to make — a
   * requester's reply always goes to the assignee — and says where it goes.
   */
  hint?: ReactNode
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-3',
        !embedded && 'rounded-xl border border-line-subtle bg-canvas p-4',
      )}
    >
      {fromAgent ? (
        <Note tone="muted">
          Drafted by the agent. Nothing has been sent — edit anything and post when it reads right.
        </Note>
      ) : null}

      <TextArea
        rows={fromAgent ? 10 : 3}
        placeholder={placeholder}
        value={body}
        onChange={(event) => onBodyChange?.(event.target.value)}
      />

      <div className="flex items-center gap-3">
        <IconButton label="Attach file" className="h-7 w-7">
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
        </IconButton>

        {hint ? (
          <span className="text-[12px] text-ink-muted">{hint}</span>
        ) : (
          <VisibilityPill mode={mode} onChange={onModeChange} />
        )}

        <div className="ml-auto">
          {hint ? (
            <Button variant="primary" onClick={onPost} disabled={!body.trim()}>
              {submitLabel}
            </Button>
          ) : (
            <SplitButton onClick={onPost} disabled={!body.trim()}>
              {submitLabel}
            </SplitButton>
          )}
        </div>
      </div>
    </section>
  )
}

function VisibilityPill({
  mode,
  onChange,
}: {
  mode: ComposerMode
  onChange?: (mode: ComposerMode) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = modes.find((m) => m.value === mode) ?? modes[0]
  const Icon = current.icon

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Visibility: ${current.label}`}
        onClick={() => setOpen((next) => !next)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-pill/60 px-3 py-1 text-[13px] leading-5 text-ink-muted transition-colors hover:text-ink',
          focusRing,
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {current.label}
        <ChevronDown className="h-3 w-3 opacity-70" strokeWidth={1.9} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 flex w-[300px] flex-col gap-0.5 rounded-xl border border-line bg-canvas p-1 shadow-lg"
        >
          {modes.map((option) => {
            const OptionIcon = option.icon
            const selected = option.value === mode
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => {
                  onChange?.(option.value)
                  setOpen(false)
                }}
                className={cn(
                  'flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-raised/60',
                  focusRing,
                )}
              >
                <OptionIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-muted" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">{option.label}</span>
                  <span className="block text-[12px] leading-snug text-ink-muted">
                    {option.consequence}
                  </span>
                </span>
                {selected ? (
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} />
                ) : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Zero required props on purpose: `/kit` renders `<UpdateComposer />` with no
 * session at all, so any coupling to one breaks the gallery immediately.
 */
export function UpdateComposer(props: Parameters<typeof ComposerView>[0] = {}) {
  return <ComposerView {...props} />
}
