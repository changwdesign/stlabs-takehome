import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, MessageSquare, SendHorizontal } from 'lucide-react'
import type { SlackThread } from '@/data/types'
import { getUser } from '@/data/users'
import type { PhaseKey, SessionAction, TicketSession } from '@/state/types'
import { cn } from '@/lib/cn'
import { Avatar } from '@/components/ui/Avatar'
import { Button, focusRing } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/TextArea'

/**
 * Things worth saying at each point in a resolution. One click fills the box —
 * nothing sends until Send, so a canned line is always a starting point.
 */
const quickReplies: Record<PhaseKey, string[]> = {
  unstarted: ['Picking this up now — updates will land here.'],
  diagnosing: ['Looking into this now — updates will land here.', 'Can you paste the exact error you see?'],
  acting: ['Found the cause — fixing it now.', 'Heads up: you may be signed out briefly while we change this.'],
  on_hold: ['Any luck signing in?', 'No rush — reply here when you get a chance.'],
  resolved: ['All set — reply here if it comes back.'],
}

/**
 * The ticket's Slack thread, kept in the rail so it stays in reach through
 * every step. What is shown is the thread itself: the original conversation
 * plus anything this session mirrored into it. Quick replies post straight to
 * the thread; anything longer belongs in the composer or in Slack.
 */
export function SlackSection({
  thread,
  session,
  requesterId,
  dispatch,
}: {
  thread: SlackThread
  session: TicketSession
  requesterId: string
  dispatch: (action: SessionAction) => void
}) {
  const [body, setBody] = useState('')
  const listRef = useRef<HTMLOListElement>(null)
  const messages = [...thread.messages, ...session.slack]
  const requester = getUser(requesterId)

  // Keep the newest message in view, like Slack does.
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  function send() {
    if (!body.trim()) return
    dispatch({ type: 'SLACK_REPLY', body })
    setBody('')
  }

  return (
    <div className="flex flex-col gap-3 pl-6">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="text-ink-muted">
          Thread in <span className="font-medium text-ink">{thread.channel}</span>
        </span>
        <ExternalLink href={thread.url}>Open in Slack</ExternalLink>
      </div>

      <ol
        ref={listRef}
        className="flex max-h-[168px] flex-col gap-3 overflow-y-auto rounded-lg border border-line-subtle bg-surface-raised/25 p-3"
      >
        {messages.map((message) => {
          const author = getUser(message.authorId)
          return (
            <li key={message.id} className="flex gap-2.5">
              <Avatar user={author} size="sm" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-[12px] leading-tight text-ink-muted">
                  <span className="font-semibold text-ink">{author.name}</span> · {message.time}
                  {message.fromPortal ? <span className="text-ink-faint"> · via portal</span> : null}
                </p>
                <p className="mt-0.5 line-clamp-4 whitespace-pre-wrap break-words text-[13px] leading-snug text-ink">
                  {message.body}
                </p>
              </div>
            </li>
          )
        })}
      </ol>

      <div className="flex flex-wrap gap-1.5">
        {quickReplies[session.phase].map((reply) => (
          <button
            key={reply}
            type="button"
            onClick={() => setBody(reply)}
            className={cn(
              'max-w-full truncate rounded-full border border-line-subtle px-2.5 py-1 text-[12px] text-ink-muted transition-colors hover:border-line hover:text-ink',
              focusRing,
            )}
          >
            {reply}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-line bg-canvas px-3 py-2">
        <TextArea
          rows={2}
          aria-label={`Reply in ${thread.channel}`}
          placeholder={`Reply to ${requester.name.split(' ')[0]} in the thread…`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          className="text-[13px]"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-ink-faint">Enter to send · logged on ticket</span>
          <Button
            variant="primary"
            disabled={!body.trim()}
            onClick={send}
            icon={<SendHorizontal className="h-3.5 w-3.5" strokeWidth={1.9} />}
          >
            Send
          </Button>
        </div>
      </div>

      <ExternalLink href={thread.dmUrl} className="self-start" icon={<MessageSquare className="h-3.5 w-3.5" strokeWidth={1.75} />}>
        Message {requester.name.split(' ')[0]} directly in Slack
      </ExternalLink>
    </div>
  )
}

function ExternalLink({
  href,
  icon,
  className,
  children,
}: {
  href: string
  icon?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1.5 rounded text-[12px] text-ink-muted transition-colors hover:text-ink',
        focusRing,
        className,
      )}
    >
      {icon}
      {children}
      <ArrowUpRight className="h-3 w-3" strokeWidth={1.9} />
    </a>
  )
}
