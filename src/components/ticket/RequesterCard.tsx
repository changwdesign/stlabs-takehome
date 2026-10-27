import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, Grid2x2, Laptop, User as UserIcon, Users } from 'lucide-react'
import type { User } from '@/data/types'
import { Avatar } from '@/components/ui/Avatar'
import { Pill } from '@/components/ui/Pill'

const HOVER_DELAY_MS = 250

/**
 * The requester pill in the header, with the details the rail used to carry:
 * who they are, reporting line, groups, devices and apps. Hover or focus shows
 * the card; a click pins it open so it survives the pointer leaving. Escape or
 * a click outside unpins it.
 */
export function RequesterCard({ user }: { user: User }) {
  const [hovered, setHovered] = useState(false)
  const [pinned, setPinned] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number>()

  useEffect(() => () => window.clearTimeout(timer.current), [])

  useEffect(() => {
    if (!pinned) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [pinned])

  function close() {
    window.clearTimeout(timer.current)
    setPinned(false)
    setHovered(false)
  }

  function preview() {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setHovered(true), HOVER_DELAY_MS)
  }

  function unpreview() {
    window.clearTimeout(timer.current)
    setHovered(false)
  }

  const open = pinned || hovered

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={preview}
      onMouseLeave={unpreview}
      onFocus={preview}
      onBlur={(event) => {
        if (!ref.current?.contains(event.relatedTarget as Node)) unpreview()
      }}
    >
      <Pill
        icon={<Avatar user={user} size="sm" />}
        lead="avatar"
        interactive={false}
        expanded={pinned}
        onClick={() => (pinned ? close() : setPinned(true))}
      >
        {user.name}
      </Pill>

      {open ? (
        // pt-2 rather than a margin keeps the hover target continuous from
        // pill to card, so moving onto the card does not close it.
        <div className="absolute left-0 top-full z-30 pt-2">
          <div
            role={pinned ? 'dialog' : 'tooltip'}
            aria-label={`${user.name}, requester`}
            className="flex w-[320px] flex-col gap-3 rounded-xl border border-line-subtle bg-canvas p-4 shadow-lg shadow-black/30"
          >
            <div className="flex items-center gap-3">
              <Avatar user={user} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{user.name}</p>
                <p className="truncate text-[12px] text-ink-muted">
                  {[user.title, user.team].filter(Boolean).join(' · ')}
                </p>
              </div>
            </div>

            <dl className="flex flex-col gap-2.5 border-t border-line-subtle pt-3">
              {user.reportsTo ? (
                <DetailRow icon={<UserIcon className="h-4 w-4" strokeWidth={1.6} />}>
                  <span className="text-ink-muted">Reports to </span>
                  <span className="text-ink">{user.reportsTo}</span>
                </DetailRow>
              ) : null}
              {user.groups?.length ? (
                <DetailRow icon={<Users className="h-4 w-4" strokeWidth={1.6} />}>
                  <span className="text-ink">{user.groups.join(', ')}</span>
                </DetailRow>
              ) : null}
              <DetailRow icon={<Laptop className="h-4 w-4" strokeWidth={1.6} />}>
                <span className="text-ink">{user.deviceCount} devices</span>
              </DetailRow>
              <DetailRow icon={<Grid2x2 className="h-4 w-4" strokeWidth={1.6} />}>
                <span className="text-ink">{user.appCount} apps</span>
              </DetailRow>
            </dl>

            <button
              type="button"
              className="inline-flex items-center justify-end gap-1.5 self-end text-[13px] text-ink-muted transition-colors hover:text-ink"
            >
              View full profile
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function DetailRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="min-w-0 truncate">{children}</span>
    </div>
  )
}
