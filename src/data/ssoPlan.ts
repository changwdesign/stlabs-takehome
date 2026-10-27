import type { HoldSpec, Suggestion, SuggestionStep, TextSegment } from './types'

const t = (value: string): TextSegment => ({ kind: 'text', value })
const b = (value: string): TextSegment => ({ kind: 'strong', value })
const c = (value: string): TextSegment => ({ kind: 'code', value })

const ACCOUNT = 'standardtemplatelabs.1password.com'

/**
 * The plan tkt-1 proved, stamped out for the rest of the cohort. Step ids
 * match tkt-1's on purpose: the pattern audit and the bulk run address steps
 * by id, and a ticket picked up one at a time gets exactly the same plan as
 * one driven from a run — there is only one machine.
 */
export interface SsoPlanInput {
  /** Requester's display name and first name, for copy. */
  name: string
  first: string
  /** Address on the 1Password profile. */
  email: string
  devices: number
  /** The profile email doesn't match the IdP, so step 2 needs a person. */
  emailMismatch?: { correct: string }
  /** No sign-in event to observe — verification asks the requester instead. */
  requesterVerify?: { label: string; followUp: string }
  /** Authored failure on enrollment. */
  enrollFault?: SuggestionStep['fault']
  /** One extra sentence for the drafted reply. */
  messageNote?: string
}

export function ssoPlan(input: SsoPlanInput): Suggestion {
  const { name, first, email, devices, emailMismatch, requesterVerify, enrollFault, messageNote } =
    input
  const finalEmail = emailMismatch?.correct ?? email

  const hold: HoldSpec | undefined = requesterVerify
    ? {
        reason: 'awaiting_requester',
        label: requesterVerify.label,
        pausesSla: true,
        check: `vc-${first.toLowerCase()}`,
        cadence: 'Nudge after 4h, again after 24h, then auto-resolve with reopen-on-reply.',
      }
    : undefined

  const steps: SuggestionStep[] = [
    {
      id: 's-check',
      label: 'Check SSO enrollment',
      actor: 'agent',
      tool: { label: '1Password admin console', icon: 'onepassword' },
      automation: {
        kind: 'auto',
        because: 'Read-only lookup in a console Grant already administers — it changes nothing.',
      },
      workflowId: 'wf-verify-enrollment',
      runLabel: 'Reading enrollment…',
      runDurationMs: 1600,
      body: [t(`Look up ${first}'s account at `), c(ACCOUNT), t(' and report whether IdP sign-in is enrolled.')],
      outcome: {
        body: emailMismatch
          ? [
              b('Not enrolled.'),
              t(' Profile email is '),
              c(email),
              t(', not '),
              c(emailMismatch.correct),
              t(' — same mismatch as TKT-2583.'),
            ]
          : [b('Not enrolled.'), t(' Profile email '), c(email), t(' already matches the IdP.')],
        activity: { verb: 'checked SSO enrollment for', object: name, trailing: '— not enrolled' },
      },
    },
    {
      id: 's-email',
      label: 'Correct the profile email',
      actor: 'assignee',
      tool: { label: '1Password admin console', icon: 'onepassword' },
      automation: { kind: 'manual' },
      dependsOn: ['s-check'],
      workflowId: 'wf-profile-email',
      notNeeded: emailMismatch ? undefined : 'the profile email already matches the IdP',
      body: emailMismatch
        ? [t(`Change the primary email on ${first}'s account to `), c(emailMismatch.correct), t('. No API for this field — by hand.')]
        : [t('Only needed if the check finds a mismatch. The agent skips it otherwise.')],
      outcome: {
        body: [t('Primary email set to '), c(finalEmail), t('.')],
        activity: { verb: 'corrected the profile email on', object: `${name}'s account` },
      },
    },
    {
      id: 's-enroll',
      label: 'Enroll the account for SSO',
      actor: 'agent',
      tool: { label: '1Password admin console', icon: 'onepassword' },
      automation: {
        kind: 'confirm',
        because: `Changes the sign-in method on someone else's account. ${first} is signed out of 1Password on ${devices === 1 ? 'their device' : `all ${devices} devices`}.`,
      },
      dependsOn: ['s-email'],
      workflowId: 'wf-enroll-sso',
      runLabel: 'Enrolling…',
      runDurationMs: 2000,
      fault: enrollFault,
      body: [t('Run '), c('Enroll user in SSO'), t(' against the account.')],
      outcome: {
        body: [t('Enrolled. Password authentication is off and '), c('op'), t(' redirects to Google.')],
        activity: { verb: 'ran workflow', object: 'Enroll user in SSO', trailing: `— ${name} enrolled` },
      },
    },
    {
      id: 's-notify',
      label: `Tell ${first} what changed`,
      actor: 'agent',
      tool: { label: 'Portal → Slack', icon: 'slack' },
      automation: {
        kind: 'auto',
        because: 'Drafts the reply on this step for review. Nothing leaves the portal until Post.',
      },
      dependsOn: ['s-enroll'],
      runLabel: 'Drafting…',
      runDurationMs: 1200,
      body: [t('Draft a reply to the original Slack thread with the sign-in command.')],
      draft: {
        mode: 'public',
        body: `Hi ${first} — your 1Password account is set up for SSO sign-in now.${
          emailMismatch ? ` Your profile email is now ${emailMismatch.correct}.` : ''
        } Enrolling signed you out on your other devices — sign back in with Google when asked.

From your terminal:

    op signin --account ${ACCOUNT}
${messageNote ? `\n${messageNote}\n` : ''}
You shouldn't need to reply — we'll see the sign-in from our side and close this out.`,
      },
      outcome: {
        body: [t('Reply posted as a '), b('Public reply'), t(' and mirrored to the Slack thread.')],
        activity: { verb: 'drafted a Slack reply', trailing: 'for review' },
      },
    },
    {
      id: 's-verify',
      label: 'Confirm the CLI signs in',
      actor: 'requester',
      tool: { label: '1Password CLI', icon: 'browser' },
      automation: { kind: 'manual' },
      dependsOn: ['s-notify'],
      body: [t(`${first} runs `), c(`op signin --account ${ACCOUNT}`), t(' and completes the browser flow.')],
      verification: requesterVerify && hold
        ? {
            id: hold.check as string,
            mode: 'requester',
            label: requesterVerify.label,
            durationMs: 0,
            followUp: requesterVerify.followUp,
            passed: [t(`${first} confirmed it works.`)],
            fallback: { label: `Ask ${first} to confirm`, hold },
          }
        : {
            id: `vc-${first.toLowerCase()}`,
            mode: 'automatic',
            label: 'Watching for a successful IdP sign-in',
            durationMs: 3600,
            followUp: `${first} is not asked anything. No sign-in → nudge after 4h, again after 24h.`,
            passed: [t('IdP sign-in observed for '), c(finalEmail), t('.')],
          },
      outcome: {
        body: requesterVerify
          ? [t(`${first} confirmed in the Slack thread.`)]
          : [t(`Sign-in observed from the identity provider — verified without asking ${first}.`)],
        activity: {
          verb: 'verified',
          object: requesterVerify ? 'by requester confirmation' : 'IdP sign-in',
          trailing: requesterVerify ? undefined : 'automatically',
        },
      },
    },
  ]

  return {
    id: `sug-sso-${first.toLowerCase()}`,
    title: `1Password CLI — IdP sign-in setup for ${first}`,
    lede: 'The plan proven on TKT-2583, applied here. The first step is a read-only check that decides whether step 2 is needed at all.',
    likelyCauseId: emailMismatch ? 'cause-profile-email' : 'cause-not-enrolled',
    workflowIds: ['wf-verify-enrollment', 'wf-enroll-sso'],
    steps,
    chips: [
      { label: 'Show similar SSO tickets', act: 'open_cohort' },
      { label: 'Something else?', act: 'none' },
    ],
  }
}
