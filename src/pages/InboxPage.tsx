import { useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { IconSidebar } from '@/components/layout/IconSidebar'
import { FilterBar, type FilterKey } from '@/components/layout/FilterBar'
import { TicketList } from '@/components/layout/TicketList'
import { ChatDock } from '@/components/layout/ChatDock'
import { RightRail } from '@/components/rail/RightRail'
import { TicketDetail } from '@/components/ticket/TicketDetail'
import { CohortPanel } from '@/components/cohort/CohortPanel'
import { RequesterPortal } from '@/components/portal/RequesterPortal'
import { patternForSource } from '@/data/patterns'
import { useAllTickets, useSession, useTicketDispatch } from '@/state/SessionProvider'
import { CURRENT_USER } from '@/state/viewer'

export function InboxPage() {
  const { ticketId } = useParams()
  const navigate = useNavigate()
  // Fixtures plus late arrivals — a ticket filed mid-session joins the list.
  const tickets = useAllTickets()
  const sendTo = useTicketDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  // `?bulk=open` is how the /bulk shortcut lands with the cohort panel up.
  const [bulkOpen, setBulkOpenState] = useState(searchParams.get('bulk') === 'open')
  function setBulkOpen(open: boolean) {
    setBulkOpenState(open)
    if (!open && searchParams.has('bulk')) setSearchParams({}, { replace: true })
  }

  /** Counts the filter bar renders, derived rather than typed in. */
  const counts: Record<FilterKey, number> = useMemo(
    () => ({
      all: tickets.length,
      mine: tickets.filter((ticket) => ticket.assigneeId === CURRENT_USER).length,
      following: tickets.filter((ticket) => ticket.followerIds.includes(CURRENT_USER)).length,
      // `Unassigned` filters on P1 as a stand-in: fixtures have no unassigned state.
      unassigned: tickets.filter((ticket) => ticket.priority === 'P1').length,
    }),
    [tickets],
  )
  const [filter, setFilter] = useState<FilterKey>('all')
  const [fallbackId, setFallbackId] = useState(tickets[0].id)
  // Collapsed on load — the section header's "8 tickets" carries the volume
  // signal. Kept here rather than inside the rail so the detail's "Show
  // similar SSO tickets" chip can open it.
  const [cohortOpen, setCohortOpen] = useState(false)

  const selectedId = ticketId ?? fallbackId

  const visible = useMemo(() => {
    switch (filter) {
      case 'mine':
        return tickets.filter((ticket) => ticket.assigneeId === CURRENT_USER)
      case 'following':
        return tickets.filter((ticket) => ticket.followerIds.includes(CURRENT_USER))
      case 'unassigned':
        return tickets.filter((ticket) => ticket.priority === 'P1')
      default:
        return tickets
    }
  }, [filter, tickets])

  // Keep a valid selection when the active filter hides the current ticket.
  const selected = visible.find((t) => t.id === selectedId) ?? visible[0] ?? tickets[0]
  const [session, dispatch] = useSession(selected)

  function select(id: string) {
    setFallbackId(id)
    setCohortOpen(false)
    setBulkOpen(false)
    if (ticketId) navigate(`/t/${id}`)
  }

  /** An excluded ticket's alternative: open it with the reply already drafted. */
  function replyInstead(id: string, body: string) {
    sendTo(id, { type: 'COMPOSER_PREFILL', mode: 'public', body })
    select(id)
  }

  // `?as=requester` previews the same ticket, and the same session, from the
  // requester's side. No inbox around it: a requester only sees their ticket.
  if (searchParams.get('as') === 'requester') return <RequesterPortal ticket={selected} />

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <IconSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <FilterBar active={filter} counts={counts} onChange={setFilter} />

        <div className="flex min-h-0 flex-1">
          <TicketList tickets={visible} selectedId={selected.id} onSelect={select} />

          <div className="relative flex min-w-0 flex-1">
            <div className="scrollbar-thin flex min-w-0 flex-1 overflow-y-auto">
              <TicketDetail
                key={selected.id}
                ticket={selected}
                onOpenCohort={() => setCohortOpen(true)}
              />
              <RightRail
                ticket={selected}
                session={session}
                dispatch={dispatch}
                cohortOpen={cohortOpen}
                onCohortOpenChange={setCohortOpen}
                onSelectTicket={select}
                onApplyBulk={patternForSource(selected.id) ? () => setBulkOpen(true) : undefined}
                bulkOpen={bulkOpen}
              />
            </div>
            <ChatDock />
            {bulkOpen ? (
              <CohortPanel
                source={selected}
                onClose={() => setBulkOpen(false)}
                onSelectTicket={select}
                onReply={replyInstead}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
