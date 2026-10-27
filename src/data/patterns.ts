import type { ResolutionPattern } from './types'

/**
 * What tkt-1's resolution becomes once it is offered to the cohort. The audit
 * is the important part: tkt-1 contains a step Grant did by hand, and that
 * cannot run unattended across seven tickets. Saying so *before* selection is
 * what keeps "apply to all" honest.
 */
export const patterns: ResolutionPattern[] = [
  {
    id: 'pat-sso-cli',
    name: 'Enroll for SSO and verify CLI sign-in',
    causeId: 'cause-not-enrolled',
    sourceTicketId: 'tkt-1',
    cohortId: 'sso-rollout',
    steps: [
      {
        stepId: 's-check',
        scale: 'auto_at_scale',
        note: 'Read-only. Already run across the set as the dry run — its result decides step 2 per ticket.',
      },
      {
        stepId: 's-email',
        scale: 'per_ticket_input',
        note: 'Manual on TKT-2583 — no API for the field. Skipped where the email already matches; the run pauses for you where it does not.',
      },
      {
        stepId: 's-enroll',
        scale: 'auto_at_scale',
        note: 'Needs approval, given once for the batch at preflight — with every affected account and device count listed.',
      },
      {
        stepId: 's-notify',
        scale: 'auto_at_scale',
        note: 'Each requester gets their own message. You read every one at preflight; nothing is sent unread.',
      },
      {
        stepId: 's-verify',
        scale: 'auto_at_scale',
        note: 'Automatic where a sign-in can be observed; falls back to asking the requester where it cannot.',
      },
    ],
    matchCriteria: [
      'Filed after the SSO enforcement rollout',
      'Error is a password prompt or "password authentication is not supported"',
      'Account is a person, not a service account',
    ],
    exclusions: {
      'tkt-20': {
        reason: 'Needs an answer, not the fix — nothing is broken yet.',
        alternative: 'reply',
        replyBody: `Hi Devon — short answer: yes, once SSO enforcement reaches your account, scripts that sign in with a password will stop working.

Before that happens, sign in once with:

    op signin --account standardtemplatelabs.1password.com

and switch any CI usage to a service-account token. We'll ping you before your account is enrolled.`,
      },
      'tkt-22': {
        reason: 'Service account — needs a token, not an interactive IdP redirect. Different sign-in path.',
      },
    },
    notes: {
      'tkt-16': 'Same cause. CI cannot be watched for a sign-in, so verification will ask Nora.',
      'tkt-17': 'Same cause. P1 — on-call is blocked. The dry run found a profile-email mismatch.',
      'tkt-18': 'Same cause. Desktop enrollment applied, CLI never did.',
      'tkt-19': 'Same cause, but assigned to Sam Oyelaran. Not yours to resolve without a takeover.',
      'tkt-21': 'Same cause. On hold for a version string the fix makes unnecessary — the run resumes it.',
    },
  },
]

const byId = new Map(patterns.map((p) => [p.id, p]))

export function getPattern(id: string): ResolutionPattern | undefined {
  return byId.get(id)
}

export function patternForSource(ticketId: string): ResolutionPattern | undefined {
  return patterns.find((p) => p.sourceTicketId === ticketId)
}
