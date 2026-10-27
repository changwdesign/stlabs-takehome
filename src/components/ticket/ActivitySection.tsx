import type { ReactNode } from 'react'
import type { ActivityEvent, Ticket } from '@/data/types'
import type { SessionAction, TicketSession } from '@/state/types'
import { activityFor } from '@/state/selectors'
import { ComposerView } from './UpdateComposer'
import { ActivityTimeline } from './ActivityTimeline'

/**
 * The composer and the log are one block: an update is written directly above
 * the place it will appear, so posting reads as adding to the log rather than
 * sending something off to a separate box.
 */
export function ActivitySection({
  ticket,
  session,
  dispatch,
}: {
  ticket: Ticket
  session: TicketSession
  dispatch: (action: SessionAction) => void
}) {
  return (
    <ActivityView
      heading="Activity"
      events={activityFor(ticket, session)}
      slackUrl={ticket.slack?.url}
      composer={
        <ComposerView
          embedded
          mode={session.composer.mode}
          body={session.composer.body}
          fromAgent={session.composer.fromAgent}
          onModeChange={(mode) => dispatch({ type: 'COMPOSER_MODE', mode })}
          onBodyChange={(body) => dispatch({ type: 'COMPOSER_BODY', body })}
          onPost={() => dispatch({ type: 'POST_UPDATE' })}
        />
      }
    />
  )
}

/** The frame, shared with the requester's portal, which brings its own events. */
export function ActivityView({
  heading,
  trailing,
  composer,
  events,
  slackUrl,
}: {
  heading: string
  trailing?: ReactNode
  composer: ReactNode
  events: ActivityEvent[]
  slackUrl?: string
}) {
  return (
    <section className="flex flex-col rounded-xl border border-line-subtle bg-canvas">
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[13px] text-ink-muted">{heading}</h2>
          {trailing}
        </div>
        {composer}
      </div>
      <div className="border-t border-line-subtle px-4 py-2">
        <ActivityTimeline events={events} slackUrl={slackUrl} />
      </div>
    </section>
  )
}
