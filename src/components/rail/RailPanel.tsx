import type { ReactNode } from 'react'
import { Users } from 'lucide-react'
import type { User } from '@/data/types'
import { AvatarStack } from '@/components/ui/Avatar'
import { CollapsibleSection } from '@/components/ui/Collapsible'

/**
 * The rail's frame: one rounded box, sections split by rules. Shared by the
 * assignee's rail and the requester's portal so the two read as one product.
 *
 * Sticky inside the detail scroller; `offset` is whatever sits above that
 * scroller (the FilterBar in the inbox, the portal header in the portal).
 */
export function RailPanel({ children, offset }: { children: ReactNode; offset: number }) {
  return (
    <aside
      className="scrollbar-thin sticky top-0 w-[360px] shrink-0 self-start overflow-y-auto py-6 pr-6"
      style={{ maxHeight: `calc(100vh - ${offset}px)` }}
    >
      <div className="overflow-hidden rounded-2xl border border-line-subtle bg-canvas">{children}</div>
    </aside>
  )
}

/** Who gets updates, and the one thing the viewer can do about it. */
export function FollowersSection({ followers, action }: { followers: User[]; action: ReactNode }) {
  return (
    <CollapsibleSection title="Followers" icon={<Users className="h-4 w-4" strokeWidth={1.75} />}>
      <div className="flex items-center justify-between pl-6">
        <AvatarStack users={followers} />
        <button type="button" className="text-[13px] text-ink-muted transition-colors hover:text-ink">
          {action}
        </button>
      </div>
    </CollapsibleSection>
  )
}
