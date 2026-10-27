import { cn } from '@/lib/cn'
import type { User } from '@/data/types'

const sizes = {
  xs: 'h-4 w-4 text-[9px]',
  sm: 'h-5 w-5 text-[10px]',
  md: 'h-6 w-6 text-[11px]',
  lg: 'h-9 w-9 text-xs',
} as const

const tones = {
  warm: 'bg-avatar-warm text-avatar-warm-ink',
  deep: 'bg-avatar-deep text-avatar-deep-ink',
  accent: 'bg-accent text-white',
} as const

export interface AvatarProps {
  user: User
  size?: keyof typeof sizes
  className?: string
}

/**
 * People render as circles; the Agent renders as a rounded-square brand tile
 * so automated activity is distinguishable at a glance in the timeline.
 */
export function Avatar({ user, size = 'md', className }: AvatarProps) {
  const isAgent = user.kind === 'agent'
  return (
    <span
      title={user.name}
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center font-semibold leading-none',
        sizes[size],
        tones[user.tone ?? 'warm'],
        isAgent ? 'rounded-[5px]' : 'rounded-full',
        className,
      )}
    >
      {isAgent ? <AgentGlyph /> : user.initials}
    </span>
  )
}

function AgentGlyph() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" aria-hidden>
      <rect x="2.5" y="4.5" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="6" cy="8.5" r="1" fill="currentColor" />
      <circle cx="10" cy="8.5" r="1" fill="currentColor" />
    </svg>
  )
}

export function AvatarStack({ users, max = 3 }: { users: User[]; max?: number }) {
  const shown = users.slice(0, max)
  return (
    <div className="flex items-center">
      {shown.map((u, i) => (
        <Avatar
          key={u.id}
          user={u}
          size="md"
          className={cn('ring-2 ring-canvas', i > 0 && '-ml-1.5')}
        />
      ))}
      <button
        type="button"
        className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface-pill text-ink-muted ring-2 ring-canvas transition-colors hover:bg-surface-raised hover:text-ink"
        aria-label="Add follower"
      >
        <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden>
          <path d="M8 3.5v9M3.5 8h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}
