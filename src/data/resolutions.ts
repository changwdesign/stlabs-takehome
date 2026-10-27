import type { ResolutionCause } from './types'

/**
 * The closed vocabulary the resolve form captures against. Picking from a list
 * rather than typing prose is what makes one resolution reusable across a
 * cohort — free text can't be matched.
 */
export const resolutionCauses: ResolutionCause[] = [
  {
    id: 'cause-profile-email',
    label: 'Profile email did not match the IdP',
    detail: 'The 1Password profile carried a different domain than the identity provider, so enrollment silently never applied.',
  },
  {
    id: 'cause-not-enrolled',
    label: 'Account was never enrolled for SSO',
    detail: 'The rollout enabled enforcement before the account was added to the enrollment group.',
  },
  {
    id: 'cause-stale-client',
    label: 'Client too old to support the IdP flow',
    detail: 'The installed CLI or desktop build predates identity-provider sign-in.',
  },
  {
    id: 'cause-service-account',
    label: 'Service account cannot use interactive sign-in',
    detail: 'Needs a service-account token rather than an IdP redirect.',
  },
  {
    id: 'cause-user-error',
    label: 'Wrong sign-in command or account shorthand',
    detail: 'No configuration change was needed — the documented command was not the one being run.',
  },
]

const byId = new Map(resolutionCauses.map((c) => [c.id, c]))

export function getCause(id: string): ResolutionCause | undefined {
  return byId.get(id)
}
