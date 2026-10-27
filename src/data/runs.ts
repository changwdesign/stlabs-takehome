import type { RunHistoryEntry } from './types'

/** Past runs, so the index isn't empty before the first live one. Index-only. */
export const runHistory: RunHistoryEntry[] = [
  {
    id: 'run-0',
    name: 'Reclaim unused seats — Q3 Figma audit',
    createdBy: 'grant',
    createdAtLabel: '3 weeks ago',
    status: 'completed_with_exceptions',
    total: 14,
    resolved: 12,
  },
]
