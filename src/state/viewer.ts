import type { Ticket } from '@/data/types'

/**
 * Role-awareness by construction. Components branch on role only to decide
 * whether an affordance *renders* — never to pick a different subtree. That is
 * enough to make the page honest about who is looking without building a
 * second page this pass.
 */
export type ViewerRole = 'assignee' | 'requester' | 'observer'

/** Stands in for "the signed-in user". */
export const CURRENT_USER = 'grant'

export function roleFor(ticket: Ticket, userId: string = CURRENT_USER): ViewerRole {
  if (ticket.assigneeId === userId) return 'assignee'
  if (ticket.requesterId === userId) return 'requester'
  return 'observer'
}
