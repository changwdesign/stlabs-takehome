import type { ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import type { Ticket } from '@/data/types'
import { RichText } from '@/components/ui/RichText'
import { SlackIcon } from '@/components/ui/SlackIcon'

export function SummaryBlock({ ticket }: { ticket: Ticket }) {
  return (
    <SummaryView
      heading="Summary"
      trailing={
        <>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 transition-colors hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            Regenerate
          </button>
          <span>·</span>
          <span>{ticket.updated}</span>
        </>
      }
      source={ticket.sourceLabel ? { label: ticket.sourceLabel, href: ticket.slack?.url } : undefined}
    >
      <RichText segments={ticket.summary} />
    </SummaryView>
  )
}

/**
 * The block under the title: a quiet heading, the text at reading size, and a
 * link back to where it came from. The portal fills it with the requester's
 * own words instead of the agent's summary.
 */
export function SummaryView({
  heading,
  trailing,
  source,
  children,
}: {
  heading: string
  trailing?: ReactNode
  source?: { label: string; href?: string }
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[13px] text-ink-muted">{heading}</h2>
        {trailing ? (
          <div className="flex items-center gap-1.5 text-[12px] text-ink-muted">{trailing}</div>
        ) : null}
      </div>

      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{children}</p>

      {source ? (
        <a
          href={source.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 self-start text-[13px] text-ink-muted transition-colors hover:text-ink"
        >
          <SlackIcon />
          {source.label}
        </a>
      ) : null}
    </section>
  )
}
