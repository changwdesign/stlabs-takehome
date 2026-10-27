import type { ActivityEvent } from '@/data/types'
import { getUser } from '@/data/users'
import { Avatar } from '@/components/ui/Avatar'
import { RichText } from '@/components/ui/RichText'
import { SlackIcon } from '@/components/ui/SlackIcon'

export function ActivityTimeline({
  events,
  slackUrl,
}: {
  events: ActivityEvent[]
  /** Where Slack-flavoured actions ("View in Slack") open. */
  slackUrl?: string
}) {
  return (
    <section className="relative flex flex-col">
      {/* Connecting rail behind the avatars */}
      <span className="absolute bottom-5 left-3 top-5 w-px bg-line-subtle" aria-hidden />

      {events.map((event) => {
        const actor = getUser(event.actorId)
        return (
          <div key={event.id} className="relative flex flex-col gap-1.5 py-2.5">
            <div className="flex items-center gap-3">
              <Avatar user={actor} size="md" className="z-10 ring-4 ring-canvas" />

              <p className="min-w-0 flex-1 truncate text-[13px] text-ink-muted">
                <span className="font-semibold text-ink">{actor.name}</span>{' '}
                <span>{event.verb}</span>
                {event.object ? <span className="font-medium text-ink"> {event.object}</span> : null}
                {event.trailing ? <span> {event.trailing}</span> : null}
                <span> · {event.time}</span>
              </p>

              {event.action?.icon === 'slack' && slackUrl ? (
                <a
                  href={slackUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex shrink-0 items-center gap-2 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  <SlackIcon />
                  {event.action.label}
                </a>
              ) : event.action ? (
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-2 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  {event.action.icon === 'slack' ? <SlackIcon /> : null}
                  {event.action.label}
                </button>
              ) : null}
            </div>

            {/* An agent run shows its receipt inline, so the timeline is
                evidence rather than a list of verbs. */}
            {event.detail ? (
              <p className="ml-9 whitespace-pre-wrap rounded-lg border border-line-subtle bg-surface-raised/25 px-3 py-2 text-[13px] leading-relaxed text-ink-muted">
                <RichText segments={event.detail} />
              </p>
            ) : null}
          </div>
        )
      })}
    </section>
  )
}
