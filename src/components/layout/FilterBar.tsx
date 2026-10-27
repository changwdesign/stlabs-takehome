import { ArrowUpDown, ChevronDown, Layers, SlidersHorizontal } from 'lucide-react'
import { Button, IconButton } from '@/components/ui/Button'
import { SearchInput } from '@/components/ui/SearchInput'
import { cn } from '@/lib/cn'

export type FilterKey = 'all' | 'mine' | 'following' | 'unassigned'

const LABELS: Record<FilterKey, string> = {
  all: 'All',
  mine: 'My Work',
  following: 'Following',
  unassigned: 'Unassigned',
}

const ORDER: FilterKey[] = ['all', 'mine', 'following', 'unassigned']

export function FilterBar({
  active,
  counts,
  onChange,
}: {
  active: FilterKey
  /** Derived from the fixtures by the page — never hardcoded here. */
  counts: Record<FilterKey, number>
  onChange: (key: FilterKey) => void
}) {
  const tabs = ORDER.map((key) => ({
    key,
    label: LABELS[key],
    // My Work carries no count in the source design.
    count: key === 'mine' ? undefined : counts[key],
  }))

  return (
    <header className="flex h-[62px] shrink-0 items-center gap-2 px-4">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[13px] font-medium leading-none transition-colors',
              isActive
                ? 'bg-accent-soft text-accent'
                : 'bg-surface-pill-alt text-ink hover:bg-surface-raised',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className={cn(isActive ? 'text-accent/80' : 'text-ink-muted')}>
                {tab.count}
              </span>
            ) : null}
          </button>
        )
      })}

      <Button
        variant="tab"
        className="rounded-xl px-3.5 py-2"
        icon={<Layers className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />}
      >
        Views
        <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
      </Button>

      <IconButton label="Filter">
        <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
      </IconButton>

      <Button
        variant="ghost"
        className="px-2"
        icon={<ArrowUpDown className="h-4 w-4" strokeWidth={1.75} />}
      >
        Newest
      </Button>

      <SearchInput placeholder="Search tickets" className="ml-auto w-[240px] rounded-xl" />
    </header>
  )
}
