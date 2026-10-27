import { useState } from 'react'
import { ChevronDown, Ticket as TicketIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Status, Ticket } from '@/data/types'
import { PriorityBadge, Redacted, StatusBadge, statusMeta } from '@/components/ui/badges'
import { useLiveStatus } from '@/state/SessionProvider'

/** Fixed order so a group never jumps position as tickets move between them. */
const GROUP_ORDER: Status[] = ['open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled']

export function TicketList({
  tickets,
  selectedId,
  onSelect,
}: {
  tickets: Ticket[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const liveStatus = useLiveStatus()
  const [collapsed, setCollapsed] = useState<Partial<Record<Status, boolean>>>({})

  // Grouped on the live status, not the fixture's — resolving a ticket has to
  // move its row, or the list quietly contradicts the detail pane.
  const groups = GROUP_ORDER.map((status) => ({
    status,
    rows: tickets.filter((ticket) => liveStatus(ticket) === status),
  })).filter((group) => group.rows.length > 0)

  return (
    <div className="flex w-[400px] shrink-0 flex-col overflow-hidden bg-surface-list">
      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {groups.map(({ status, rows }) => {
          const open = !collapsed[status]
          return (
            <div key={status}>
              <button
                type="button"
                onClick={() => setCollapsed((prev) => ({ ...prev, [status]: open }))}
                aria-expanded={open}
                className="flex w-full shrink-0 items-center gap-2 bg-surface-raised/40 px-4 py-2 text-left"
              >
                <ChevronDown
                  className={cn(
                    'h-3.5 w-3.5 text-ink-muted transition-transform duration-200',
                    !open && '-rotate-90',
                  )}
                />
                <StatusBadge status={status} className="text-[13px] text-ink" />
                <span className="text-[13px] text-ink-muted">{rows.length}</span>
              </button>

              {open
                ? rows.map((ticket) => (
                    <TicketListRow
                      key={ticket.id}
                      ticket={ticket}
                      status={liveStatus(ticket)}
                      selected={ticket.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))
                : null}
            </div>
          )
        })}

        {tickets.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-ink-muted">
            No tickets match this filter.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function TicketListRow({
  ticket,
  status,
  selected,
  onSelect,
}: {
  ticket: Ticket
  status: Status
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      aria-current={selected}
      title={statusMeta[status].label}
      className={cn(
        'relative flex w-full flex-col gap-2 border-b border-line-subtle px-4 py-3 text-left transition-colors',
        selected ? 'bg-surface-raised' : 'hover:bg-surface-raised/40',
      )}
    >
      {selected ? (
        <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden />
      ) : null}

      <div className="flex items-start gap-2.5">
        <TicketIcon className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.6} />
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {ticket.redacted ? <RedactedTitle title={ticket.title} /> : ticket.title}
        </span>
        <span className="shrink-0 text-[12px] text-ink-muted">{ticket.age}</span>
      </div>

      <div className="flex items-center gap-2 pl-[26px]">
        <StatusBadge status={status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
    </button>
  )
}

/** Mirrors the masked rows in the source screenshots. */
function RedactedTitle({ title }: { title: string }) {
  const words = title.split(' ').slice(0, 5)
  return (
    <span className="flex items-center gap-1.5">
      {words.map((w, i) => (
        <Redacted key={i} width={Math.max(22, Math.min(74, w.length * 7))} />
      ))}
    </span>
  )
}
