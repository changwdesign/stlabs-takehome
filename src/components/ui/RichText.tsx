import type { TextSegment } from '@/data/types'

/**
 * Renders the mixed prose/code/emphasis segments used by summaries and
 * suggestion steps. Keeping this one renderer means fixture authors never
 * need to touch JSX.
 */
export function RichText({ segments }: { segments: TextSegment[] }) {
  return (
    <>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case 'strong':
            return (
              <strong key={i} className="font-semibold text-ink">
                {seg.value}
              </strong>
            )
          case 'code':
            return <Mono key={i}>{seg.value}</Mono>
          case 'link':
            return (
              <a key={i} href="#" className="text-ink underline decoration-line underline-offset-4">
                {seg.value}
              </a>
            )
          default:
            return <span key={i}>{seg.value}</span>
        }
      })}
    </>
  )
}

export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[13px] text-ink underline decoration-line decoration-1 underline-offset-[3px]">
      {children}
    </code>
  )
}
