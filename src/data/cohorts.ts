import type { Cohort } from './types'

/**
 * A cohort is a set of tickets with one shared cause. Membership is authored
 * (`Ticket.cohortId`); per-ticket match confidence lives on the `RelatedLink`,
 * so a ticket can be *listed* as related without being *in* the cohort.
 */
export const cohorts: Cohort[] = [
  {
    id: 'sso-rollout',
    label: 'SSO enforcement rollout',
    blurb: 'tickets from the SSO enforcement rollout',
    cause: 'Password authentication was disabled org-wide before per-account IdP sign-in was configured.',
    threshold: 0.8,
    listFloor: 0.5,
    notYetAffected: 34,
  },
]

const byId = new Map(cohorts.map((c) => [c.id, c]))

export function getCohort(id: string): Cohort | undefined {
  return byId.get(id)
}
