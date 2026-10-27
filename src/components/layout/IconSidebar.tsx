import {
  BarChart3,
  Inbox,
  MessageSquare,
  Megaphone,
  Plug,
  Settings,
  Target,
  Users,
  Workflow as WorkflowIcon,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/cn'
import { getUser } from '@/data/users'
import { openCount } from '@/data/tickets'
import { Avatar } from '@/components/ui/Avatar'
import { useRuns } from '@/state/SessionProvider'
import { isRunLive, runItems, runStatus } from '@/state/runs'

const nav = [
  { icon: MessageSquare, label: 'Conversations', to: '/conversations' },
  { icon: Inbox, label: 'Tickets', to: '/' },
  { icon: Users, label: 'People', to: '/people' },
  { icon: BarChart3, label: 'Reports', to: '/reports' },
  { icon: Target, label: 'Goals', to: '/goals' },
  { icon: WorkflowIcon, label: 'Workflows', to: '/workflows' },
  { icon: Plug, label: 'Integrations', to: '/integrations' },
  { icon: Settings, label: 'Settings', to: '/settings' },
]

export function IconSidebar() {
  // A run outlives the ticket it started on, so the way back to it is always
  // on screen while it is live.
  const [root] = useRuns()
  const liveRuns = Object.values(root.runs).filter((run) =>
    isRunLive(runStatus(run, runItems(run, root))),
  ).length

  return (
    <nav className="flex w-[64px] shrink-0 flex-col items-center gap-1 bg-surface-rail py-3.5">
      {/* Derived, so adding a fixture ticket updates the badge. */}
      <LogoTile count={openCount} />

      <div className="mt-4 flex flex-col items-center gap-1">
        {nav.map(({ icon: Icon, label, to }) => (
          <NavLink
            key={label}
            to={to}
            title={label}
            aria-label={label}
            className={({ isActive }) =>
              cn(
                'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
                isActive
                  ? 'bg-surface-raised text-ink'
                  : 'text-ink-muted hover:bg-surface-raised/60 hover:text-ink',
              )
            }
          >
            <span className="relative">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {to === '/workflows' && liveRuns > 0 ? (
                <span
                  className="absolute -right-1.5 -top-1.5 h-2 w-2 animate-pulse rounded-full bg-step-running ring-2 ring-surface-rail"
                  aria-label={`${liveRuns} run in progress`}
                />
              ) : null}
            </span>
          </NavLink>
        ))}
      </div>

      <div className="mt-auto flex flex-col items-center gap-3">
        <NavLink
          to="/kit"
          title="Component kit"
          aria-label="Component kit"
          className={({ isActive }) =>
            cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              isActive
                ? 'bg-surface-raised text-ink'
                : 'text-ink-muted hover:bg-surface-raised/60 hover:text-ink',
            )
          }
        >
          <Megaphone className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </NavLink>
        <Avatar user={getUser('grant')} size="lg" className="h-7 w-7 text-[11px]" />
      </div>
    </nav>
  )
}

function LogoTile({ count }: { count: number }) {
  return (
    <div className="relative">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent text-white">
        <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden>
          <rect x="2" y="5" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="7.2" cy="10.5" r="1.2" fill="currentColor" />
          <circle cx="12.8" cy="10.5" r="1.2" fill="currentColor" />
        </svg>
      </div>
      <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-white ring-2 ring-surface-rail">
        {count}
      </span>
    </div>
  )
}
