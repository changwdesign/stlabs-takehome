import type { ActivityEvent, TextSegment, Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import { planProgress, slaFor } from './selectors'
import type { TicketSession } from './types'

/**
 * The requester's reading of a session. Same state the assignee works from,
 * told from the other side: no plan internals, no policy rows, and one
 * answer to "do I need to do anything?".
 */

/** One message, as the latest-update card shows it. */
export interface PortalMessage {
  id: string
  authorId: string
  time: string
  body: string
}

/** What the requester first asked, in their own words, where we have them. */
export function originalRequest(ticket: Ticket): PortalMessage | undefined {
  return ticket.slack?.messages.find((m) => m.authorId === ticket.requesterId)
}

export type PortalNow =
  | { kind: 'action'; title: string; detail?: TextSegment[]; confirm: boolean; paused: boolean }
  | { kind: 'received'; handler: string }
  | { kind: 'update'; message?: PortalMessage; progress?: { done: number; total: number } }
  | { kind: 'waiting'; title: string; paused: boolean }
  | { kind: 'resolved'; handler: string }

/** The one card at the top of the portal, chosen by whether anything is owed. */
export function portalNow(ticket: Ticket, session: TicketSession): PortalNow {
  const handler = getUser(ticket.assigneeId).name
  const hold = session.status === 'on_hold' ? session.hold?.spec : undefined

  if (session.status === 'resolved' || session.status === 'closed') {
    return { kind: 'resolved', handler }
  }
  if (hold?.reason === 'awaiting_requester') {
    return {
      kind: 'action',
      title: hold.ask?.title ?? 'We need a reply from you',
      detail: hold.ask?.detail,
      // A hold that clears on a check is a yes/no; anything else wants words.
      confirm: Boolean(hold.check),
      paused: hold.pausesSla,
    }
  }
  if (hold) return { kind: 'waiting', title: hold.label, paused: hold.pausesSla }
  if (session.status === 'open') return { kind: 'received', handler }

  const latestEvent = portalEvents(ticket, session).find(
    (event) => event.actorId !== ticket.requesterId && event.detail,
  )
  const latest: PortalMessage | undefined = latestEvent
    ? {
        id: latestEvent.id,
        authorId: latestEvent.actorId,
        time: latestEvent.time,
        body: latestEvent.detail!.map((segment) => segment.value).join(''),
      }
    : undefined
  const progress = planProgress(ticket, session)
  return {
    kind: 'update',
    message: latest,
    progress: progress.total ? { done: progress.done, total: progress.total } : undefined,
  }
}

/**
 * Everything the requester can see happened, newest first like the
 * assignee's log: messages both ways plus the moments the ticket changed
 * hands or state (picked up, put on hold, resolved). Live events carry their
 * own requester wording (`portal`); anything without it stays internal.
 *
 * The older part comes from the fixture: the Slack thread where there is one,
 * otherwise the fixture events marked for the portal, under an "opened"
 * event so the log never starts empty.
 */
export function portalEvents(ticket: Ticket, session: TicketSession): ActivityEvent[] {
  const live = session.appended.flatMap((event) =>
    event.portal
      ? [{ id: event.id, actorId: event.actorId, time: event.time, ...event.portal }]
      : [],
  )

  const earlier: ActivityEvent[] = ticket.slack
    ? [...ticket.slack.messages].reverse().map((m) => ({
        id: m.id,
        actorId: m.authorId,
        verb: m.authorId === ticket.requesterId ? 'wrote' : 'replied',
        time: m.time,
        detail: [{ kind: 'text' as const, value: m.body }],
      }))
    : [
        ...ticket.activity.flatMap((event) =>
          event.portal
            ? [{ id: event.id, actorId: event.actorId, time: event.time, ...event.portal }]
            : [],
        ),
        {
          id: 'portal-opened',
          actorId: ticket.requesterId,
          verb: 'opened this request',
          time: `${ticket.age} ago`,
        },
      ]

  return [...live, ...earlier]
}

/** Status in the requester's terms: "on hold" splits by who it waits on. */
export function portalStatusLabel(session: TicketSession): string {
  switch (session.status) {
    case 'open':
      return 'Received'
    case 'in_progress':
      return 'In progress'
    case 'on_hold':
      return session.hold?.spec.reason === 'awaiting_requester' ? 'Waiting on you' : 'On hold'
    case 'resolved':
      return 'Resolved'
    case 'closed':
      return 'Closed'
    case 'cancelled':
      return 'Cancelled'
  }
}

/** The resolution target as a promise, not a policy row. */
export function portalTarget(ticket: Ticket, session: TicketSession) {
  const resolution = slaFor(ticket, session).find((s) => s.label === 'Resolution')
  if (!resolution?.target) return undefined
  return { target: resolution.target, paused: resolution.state === 'paused' }
}
