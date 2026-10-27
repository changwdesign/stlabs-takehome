import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Eye, Hourglass, Inbox, Info, PauseCircle } from 'lucide-react'
import type { Ticket } from '@/data/types'
import { getUser } from '@/data/users'
import { useSession } from '@/state/SessionProvider'
import {
  originalRequest,
  portalEvents,
  portalNow,
  portalStatusLabel,
  portalTarget,
  type PortalNow,
} from '@/state/requester'
import type { SessionAction, TicketSession } from '@/state/types'
import { Avatar } from '@/components/ui/Avatar'
import { Button, focusRing } from '@/components/ui/Button'
import { CollapsibleSection } from '@/components/ui/Collapsible'
import { MetaField, Pill } from '@/components/ui/Pill'
import { Note } from '@/components/ui/Note'
import { RichText } from '@/components/ui/RichText'
import { SlackIcon } from '@/components/ui/SlackIcon'
import { SlaBadge, StatusRing } from '@/components/ui/badges'
import { StepProgress } from '@/components/ui/StepProgress'
import { TicketTitle } from '@/components/ticket/TicketHeader'
import { SummaryView } from '@/components/ticket/SummaryBlock'
import { NextActionCard } from '@/components/ticket/NextActionRegion'
import { ActivityView } from '@/components/ticket/ActivitySection'
import { ComposerView } from '@/components/ticket/UpdateComposer'
import { FollowersSection, RailPanel } from '@/components/rail/RailPanel'
import { cn } from '@/lib/cn'

/** Preview banner (36px) plus the portal header (56px) — what the rail sticks under. */
const CHROME_HEIGHT = 92

/**
 * The ticket as its requester sees it. Reads and writes the same session as
 * the assignee's view, and is built from the same parts — title block, meta
 * fields, next-action card, summary, activity, rail — so the two read as one
 * product. What differs is what each part is given: read-only fields, the
 * requester's own words, public messages only.
 *
 * The next-action card always answers "do I need to do anything?". It holds
 * one place — under the request, as on the assignee's page — and only takes
 * the accent when the requester actually owes something. The log under it
 * is always there: messages plus every change of state.
 */
export function RequesterPortal({ ticket }: { ticket: Ticket }) {
  const [session, dispatch] = useSession(ticket)
  const requester = getUser(ticket.requesterId)
  const assignee = getUser(ticket.assigneeId)
  const now = portalNow(ticket, session)
  const original = originalRequest(ticket)
  const [reply, setReply] = useState('')

  function focusReply() {
    document.querySelector<HTMLTextAreaElement>('#portal-reply textarea')?.focus()
  }

  const card = <NowCard now={now} dispatch={dispatch} onReply={focusReply} />

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-canvas">
      <PreviewBanner ticket={ticket} requester={requester.name} />

      <header className="flex h-14 shrink-0 items-center justify-between border-b border-line-subtle px-8">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-canvas">
            <Inbox className="h-4 w-4" strokeWidth={2} />
          </span>
          IT Help
        </div>
        <div className="flex items-center gap-2 text-[13px] text-ink-muted">
          {requester.name}
          <Avatar user={requester} size="md" />
        </div>
      </header>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1240px]">
          <article className="flex min-w-0 flex-1 flex-col gap-7 py-6 pl-8 pr-6">
            <header className="flex flex-col gap-5">
              <TicketTitle ticket={ticket} />
              {/* Same fields as the assignee's meta row, read-only: no ring,
                  no caret, since the requester cannot change either. */}
              <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                <MetaField label="Status">
                  <Pill lead="ring" interactive={false} icon={<StatusRing status={session.status} />}>
                    {portalStatusLabel(session)}
                  </Pill>
                </MetaField>
                <MetaField label="Assignee">
                  <Pill lead="avatar" interactive={false} icon={<Avatar user={assignee} size="sm" />}>
                    {assignee.name}
                  </Pill>
                </MetaField>
              </div>
            </header>

            {/* The agent's summary is written for the assignee, so the
                requester gets their own words — or nothing. */}
            {original ? (
              <SummaryView
                heading="What you asked"
                source={
                  ticket.slack
                    ? { label: `Asked in ${ticket.slack.channel} · ${original.time}`, href: ticket.slack.url }
                    : undefined
                }
              >
                {original.body}
              </SummaryView>
            ) : null}

            {/* Always here, as on the assignee's page: what was asked, then
                what to do about it. The accent, not the position, says when
                something is owed. */}
            {card}

            <div id="portal-reply">
              <ActivityView
                heading="Activity"
                events={portalEvents(ticket, session)}
                slackUrl={ticket.slack?.url}
                composer={
                  <ComposerView
                    embedded
                    body={reply}
                    onBodyChange={setReply}
                    onPost={() => {
                      dispatch({ type: 'REQUESTER_REPLY', body: reply })
                      setReply('')
                    }}
                    placeholder={`Reply to ${assignee.name.split(' ')[0]}…`}
                    submitLabel="Send"
                    hint={
                      ticket.slack
                        ? `Also posts in the ${ticket.slack.channel} thread`
                        : `Goes to ${assignee.name}`
                    }
                  />
                }
              />
            </div>

            <div className="h-16 shrink-0" aria-hidden />
          </article>

          <PortalRail ticket={ticket} session={session} />
        </div>
      </div>
    </div>
  )
}

/* ---------------- preview banner ---------------- */

function PreviewBanner({ ticket, requester }: { ticket: Ticket; requester: string }) {
  return (
    <div className="flex h-9 shrink-0 items-center justify-center gap-3 border-b border-accent/20 bg-accent-soft text-[12px] text-ink-muted">
      <Eye className="h-3.5 w-3.5 text-accent" strokeWidth={1.75} />
      <span>
        Previewing the portal as <span className="text-ink">{requester}</span>
      </span>
      <span aria-hidden>·</span>
      <Link
        to={`/t/${ticket.id}`}
        className={cn('inline-flex items-center gap-1 rounded text-ink hover:underline', focusRing)}
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
        Back to operator view
      </Link>
    </div>
  )
}

/* ---------------- the next-action card ---------------- */

function NowCard({
  now,
  dispatch,
  onReply,
}: {
  now: PortalNow
  dispatch: (action: SessionAction) => void
  onReply: () => void
}) {
  switch (now.kind) {
    case 'action':
      return <ActionCard now={now} dispatch={dispatch} />

    case 'received':
      return (
        <NextActionCard
          quiet
          descriptor={{
            eyebrow: 'Received',
            title: `${now.handler} will pick this up`,
            detail: 'Nothing is needed from you. Updates land here and in Slack.',
          }}
        />
      )

    case 'update': {
      const author = now.message ? getUser(now.message.authorId) : undefined
      return (
        <NextActionCard
          quiet
          descriptor={{
            eyebrow: now.message ? `Latest update · ${now.message.time}` : 'Latest update',
            title: author ? `${author.name} replied` : 'Work has started',
            detail: author ? '' : 'Nothing is needed from you.',
          }}
        >
          {now.message ? (
            <p className="line-clamp-4 whitespace-pre-wrap text-[14px] leading-relaxed text-ink-muted">
              {now.message.body}
            </p>
          ) : null}
          {now.progress ? <StepProgress {...now.progress} /> : null}
        </NextActionCard>
      )
    }

    case 'waiting':
      return (
        <NextActionCard
          quiet
          descriptor={{ eyebrow: 'On hold', title: now.title, detail: 'Nothing is needed from you.' }}
        >
          {now.paused ? <PausedNote>The resolution timer is paused while we wait.</PausedNote> : null}
        </NextActionCard>
      )

    case 'resolved':
      return (
        <NextActionCard
          resolved
          descriptor={{ eyebrow: 'Resolved', title: `${now.handler} marked this resolved`, detail: '' }}
        >
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Still not working?{' '}
            <button
              type="button"
              onClick={onReply}
              className={cn('rounded text-ink underline underline-offset-4', focusRing)}
            >
              Reply below
            </button>{' '}
            and it goes straight back to {now.handler.split(' ')[0]}.
          </p>
        </NextActionCard>
      )
  }
}

function ActionCard({
  now,
  dispatch,
}: {
  now: Extract<PortalNow, { kind: 'action' }>
  dispatch: (action: SessionAction) => void
}) {
  // A yes/no ask starts as two buttons; "Still not working" opens the box.
  const [writing, setWriting] = useState(!now.confirm)
  const [body, setBody] = useState('')

  return (
    <NextActionCard descriptor={{ eyebrow: 'Action needed', title: now.title, detail: '' }}>
      {now.detail ? (
        <p className="text-[14px] leading-relaxed text-ink-muted">
          <RichText segments={now.detail} />
        </p>
      ) : null}

      {now.confirm && !writing ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button variant="primary" onClick={() => dispatch({ type: 'RESUME' })}>
            Yes, it works
          </Button>
          <Button variant="ghost" onClick={() => setWriting(true)}>
            Still not working
          </Button>
        </div>
      ) : (
        <ComposerView
          body={body}
          onBodyChange={setBody}
          onPost={() => {
            dispatch({ type: 'REQUESTER_REPLY', body })
            setBody('')
            if (now.confirm) setWriting(false)
          }}
          placeholder={now.confirm ? 'What happens when you try?' : 'Paste it here…'}
          submitLabel="Send"
          hint="Goes to the conversation below"
        />
      )}

      {now.paused ? <PausedNote>The resolution timer is paused until you reply.</PausedNote> : null}
    </NextActionCard>
  )
}

/** Same note the assignee's hold panel uses for a paused clock. */
function PausedNote({ children }: { children: ReactNode }) {
  return (
    <Note tone="muted" icon={<PauseCircle className="h-3.5 w-3.5" strokeWidth={1.75} />}>
      {children}
    </Note>
  )
}

/* ---------------- rail ---------------- */

/**
 * The assignee's rail frame and section headers, holding what a requester
 * needs: when to expect it, the basics, the thread, and who else is told.
 */
function PortalRail({ ticket, session }: { ticket: Ticket; session: TicketSession }) {
  const target = portalTarget(ticket, session)
  const handler = getUser(ticket.assigneeId).name.split(' ')[0]
  const resolution = session.resolution

  return (
    <RailPanel offset={CHROME_HEIGHT}>
      {resolution || target ? (
        <CollapsibleSection title="Expected" icon={<Hourglass className="h-4 w-4" strokeWidth={1.75} />}>
          <div className="flex flex-col gap-3 pl-6">
            <div className="flex flex-col gap-2">
              <span className="text-[12px] text-ink-muted">Resolution</span>
              {resolution ? (
                <>
                  <SlaBadge value={`Resolved in ${resolution.timeToResolve}`} state="ok" className="self-start" />
                  <span className="text-[11px] leading-none text-ink-faint">target {resolution.target}</span>
                </>
              ) : target ? (
                <>
                  <SlaBadge
                    value={`Within ${target.target}`}
                    state={target.paused ? 'paused' : 'ok'}
                    className="self-start"
                  />
                  <span className="text-[11px] leading-none text-ink-faint">
                    {session.status === 'open'
                      ? `counted from when ${handler} picks it up`
                      : `counted from when ${handler} picked it up`}
                  </span>
                </>
              ) : null}
            </div>
            {target?.paused && !resolution ? (
              <PausedNote>
                {session.hold?.spec.reason === 'awaiting_requester'
                  ? 'Paused until you reply.'
                  : 'Paused while this is on hold.'}
              </PausedNote>
            ) : null}
          </div>
        </CollapsibleSection>
      ) : null}

      <CollapsibleSection title="Details" icon={<Info className="h-4 w-4" strokeWidth={1.75} />}>
        <dl className="flex flex-col gap-2 pl-6 text-[13px]">
          <Detail label="Opened">{ticket.age} ago</Detail>
          <Detail label="Team">{ticket.queue}</Detail>
        </dl>
      </CollapsibleSection>

      {ticket.slack ? (
        <CollapsibleSection
          title="Slack thread"
          icon={<SlackIcon className="h-4 w-4" />}
          trailing={ticket.slack.channel}
          defaultOpen={false}
        >
          <a
            href={ticket.slack.url}
            target="_blank"
            rel="noreferrer"
            className="block pl-6 text-[13px] text-ink-muted transition-colors hover:text-ink"
          >
            Open the thread in Slack. Replies there and here stay in sync.
          </a>
        </CollapsibleSection>
      ) : null}

      <FollowersSection followers={ticket.followerIds.map(getUser)} action="Add" />
    </RailPanel>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="truncate text-ink">{children}</dd>
    </div>
  )
}
