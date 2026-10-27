import type { HoldSpec, SlaPolicy, Ticket, TextSegment } from './types'
import { ssoPlan } from './ssoPlan'

const t = (value: string): TextSegment => ({ kind: 'text', value })
const b = (value: string): TextSegment => ({ kind: 'strong', value })
const c = (value: string): TextSegment => ({ kind: 'code', value })

/** Baseline SLA shape reused by most of the list-only tickets. */
const okSla = () => [
  { label: 'Response', value: '4h', state: 'ok' as const },
  { label: 'Resolution', value: '2d', state: 'ok' as const, target: '2d', pausable: true },
]

/**
 * The policy rows the SLA panels reference. `reference` matches the fixture's
 * own targets, so nothing reads as overridden until somebody actually moves it.
 */
const credentialAccessSla: SlaPolicy = {
  label: 'P2 · IT Requests · credential access',
  basis: 'Matched on priority P2 and the queue. The row assumes a single-user fix with no step owned by the requester.',
  reference: { Response: '4h', Resolution: '2h' },
  options: { Response: ['1h', '2h', '4h', '8h'], Resolution: ['2h', '4h', '8h', '1d'] },
  suggestion: {
    slaLabel: 'Resolution',
    target: '4h',
    because:
      'Seven other tickets share this cause and the last step is Aidan re-running sign-in — the 2h row does not account for a requester step.',
  },
  reasons: [
    'Requester action is on the critical path',
    'Shared-cause cohort — the root fix outlasts one ticket',
    'Escalated: business-critical access',
    'Agreed with the requester',
  ],
}

const hardwareSla: SlaPolicy = {
  label: 'P2 · Hardware · warranty replacement',
  basis: 'Matched on priority P2 and the queue. Shipping time sits inside the resolution clock.',
  reference: { Response: '4h', Resolution: '2d' },
  options: { Response: ['1h', '2h', '4h', '8h'], Resolution: ['1d', '2d', '3d', '5d'] },
  reasons: [
    'Courier lead time outside our control',
    'Depends on a third party',
    'Escalated: no spare device available',
    'Agreed with the requester',
  ],
}

/** The hold tkt-1 falls back to when the automatic check can't settle it. */
const awaitAidan: HoldSpec = {
  reason: 'awaiting_requester',
  label: 'Waiting on Aidan to confirm the CLI signs in',
  pausesSla: true,
  check: 'vc-idp-signin',
  cadence: 'Nudge after 4h, again after 24h, then auto-resolve with reopen-on-reply.',
  ask: {
    title: 'Check that the 1Password CLI signs you in',
    detail: [
      t('Run '),
      c('op signin --account standardtemplatelabs.1password.com'),
      t(' and finish the sign-in in your browser.'),
    ],
  },
}

export const tickets: Ticket[] = [
  {
    id: 'tkt-1',
    key: 'TKT-AZURE-TALK-2583',
    title: '1Password CLI sign-in fails — password [redacted] no longer supported',
    status: 'open',
    priority: 'P2',
    queue: 'IT Requests',
    assigneeId: 'grant',
    requesterId: 'aidan',
    age: '1d',
    updated: 'Updated 2 days ago',
    sourceLabel: 'View original conversation',
    slack: {
      channel: '#it-help',
      url: 'https://stlabs.slack.com/archives/C04ITHELP/p1729771200000100',
      dmUrl: 'https://stlabs.slack.com/team/U03AIDANSG',
      messages: [
        {
          id: 'sl-1',
          authorId: 'aidan',
          time: '2d ago',
          body: "hey — `op signin` started saying password sign-in is no longer supported?? can't pull secrets for local dev. did something change?",
        },
        {
          id: 'sl-2',
          authorId: 'agent',
          time: '2d ago',
          body: "Thanks Aidan — this looks tied to this week's SSO enforcement rollout. I've opened TKT-AZURE-TALK-2583 and assigned it to Grant Fuhr. Updates will land in this thread.",
        },
        { id: 'sl-3', authorId: 'aidan', time: '2d ago', body: 'ty 🙏' },
      ],
    },
    cohortId: 'sso-rollout',
    hold: awaitAidan,
    expected: { timeToResolve: '1h 12m', target: '2h', withinTarget: true },
    summary: [
      t("Aidan's 1Password CLI is "),
      b('blocked'),
      t(
        ' — password authentication has been disabled org-wide as part of the SSO enforcement rollout, and the identity-provider CLI flow has not yet been configured for their account.',
      ),
    ],
    suggestion: {
      id: 'sug-sso-cli',
      title: '1Password CLI — IdP sign-in setup needed for Aidan',
      lede: 'Five steps, three of which the agent can run. The first is a read-only lookup that should tell us why enrollment never applied.',
      likelyCauseId: 'cause-profile-email',
      // First time this has been solved: no workflow exists yet. One is saved
      // from this resolution once it has proven out (see the run close-out).
      workflowIds: [],
      steps: [
        {
          id: 's-check',
          label: 'Check SSO enrollment',
          actor: 'agent',
          tool: { label: '1Password admin console', icon: 'onepassword' },
          automation: {
            kind: 'auto',
            because:
              'Read-only lookup in a console Grant already administers — it changes nothing and is reversible by definition.',
          },
          runLabel: 'Reading enrollment…',
          runDurationMs: 2200,
          body: [
            t("Look up Aidan's account at "),
            c('standardtemplatelabs.1password.com'),
            t(' and report whether identity-provider sign-in is enrolled.'),
          ],
          outcome: {
            body: [
              b('Not enrolled.'),
              t(' The profile email on the account is '),
              c('aidan@stlabs.io'),
              t(', not '),
              c('aidan@stlabs.com'),
              t(' — enrollment is scoped to the '),
              c('.com'),
              t(' domain, so it never applied to this account.'),
            ],
            activity: {
              verb: 'checked SSO enrollment for',
              object: 'Aidan Singh',
              trailing: '— not enrolled',
            },
          },
        },
        {
          id: 's-email',
          label: 'Correct the profile email',
          actor: 'assignee',
          tool: { label: '1Password admin console', icon: 'onepassword' },
          automation: { kind: 'manual' },
          dependsOn: ['s-check'],
          body: [
            t("Change the primary email on Aidan's account to "),
            c('aidan@stlabs.com'),
            t('. The admin console exposes no API for the primary email field, so this one is by hand.'),
          ],
          outcome: {
            body: [t('Primary email set to '), c('aidan@stlabs.com'), t('.')],
            activity: { verb: 'corrected the profile email on', object: "Aidan Singh's account" },
          },
        },
        {
          id: 's-enroll',
          label: 'Enroll the account for SSO',
          actor: 'agent',
          tool: { label: '1Password admin console', icon: 'onepassword' },
          automation: {
            kind: 'confirm',
            because:
              "Changes the sign-in method on someone else's account. Aidan will be signed out of 1Password on all 2 devices and must re-authenticate through Google.",
          },
          dependsOn: ['s-email'],
          runLabel: 'Enrolling…',
          runDurationMs: 2600,
          body: [t('Turn on identity-provider sign-in for the corrected account.')],
          outcome: {
            body: [
              t('Enrolled. Password authentication is now off for this account and '),
              c('op'),
              t(' will redirect to Google.'),
            ],
            activity: {
              verb: 'enrolled',
              object: 'Aidan Singh',
              trailing: 'for SSO sign-in',
            },
          },
        },
        {
          id: 's-notify',
          label: 'Tell Aidan what changed',
          actor: 'agent',
          tool: { label: 'Portal → Slack', icon: 'slack' },
          automation: {
            kind: 'auto',
            because:
              'Drafts the reply on this step for Grant to read. Nothing leaves the portal until Post.',
          },
          dependsOn: ['s-enroll'],
          runLabel: 'Drafting…',
          runDurationMs: 1600,
          body: [
            t('Draft a reply to the original Slack thread with the corrected sign-in command and the setup guide.'),
          ],
          draft: {
            mode: 'public',
            body: `Hi Aidan — your 1Password account is set up for SSO sign-in now.

Two things changed on our side: your profile email is now aidan@stlabs.com, and the account is enrolled for identity-provider sign-in. That signed you out of 1Password on your other devices — sign back in with Google when they ask.

From your terminal:

    op signin --account standardtemplatelabs.1password.com

That opens a browser and signs you in through Google instead of asking for a password. You shouldn't need to reply — we'll see the sign-in from our side and close this out.`,
            attachments: [{ name: '1password-cli-sso-signin.pdf', size: '184 KB' }],
          },
          outcome: {
            body: [
              t('Reply posted as a '),
              b('Public reply'),
              t(' and mirrored to the Slack thread.'),
            ],
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
          body: [
            t('Aidan runs '),
            c('op signin --account standardtemplatelabs.1password.com'),
            t(' and completes the browser SSO flow.'),
          ],
          verification: {
            id: 'vc-idp-signin',
            mode: 'automatic',
            label: 'Watching for a successful IdP sign-in',
            durationMs: 4200,
            followUp:
              'Aidan is not asked anything. If no sign-in arrives we nudge after 4h, again after 24h, then auto-resolve with reopen-on-reply.',
            passed: [
              t('Successful identity-provider sign-in observed for '),
              c('aidan@stlabs.com'),
              t(' via Google, '),
              c('op'),
              t(' 2.30.3. No reply needed from Aidan.'),
            ],
            fallback: { label: 'Ask Aidan to confirm instead', hold: awaitAidan },
          },
          outcome: {
            body: [
              t('Sign-in observed from the identity provider — verified without asking Aidan anything.'),
            ],
            activity: { verb: 'verified', object: 'IdP sign-in', trailing: 'automatically' },
          },
        },
      ],
      chips: [
        { label: 'Walk me through it', act: 'explain' },
        { label: 'Show similar SSO tickets', act: 'open_cohort' },
        { label: 'Something else?', act: 'none' },
      ],
    },
    sla: [
      { label: 'Response', value: '+1d', state: 'breached', target: '4h' },
      { label: 'Resolution', value: '58m', state: 'at_risk', target: '2h', pausable: true },
    ],
    slaPolicy: credentialAccessSla,
    followerIds: ['aidan', 'grant'],
    related: [
      { ticketId: 'tkt-17', reason: 'Same error on the on-call runbook — password prompt after enforcement', confidence: 0.96 },
      { ticketId: 'tkt-16', reason: 'Same cause, non-interactive: op read fails in CI since enforcement', confidence: 0.94 },
      { ticketId: 'tkt-21', reason: 'Same cause, already on hold waiting on the requester', confidence: 0.9 },
      { ticketId: 'tkt-18', reason: 'Desktop app works, CLI does not — same missing IdP CLI config', confidence: 0.88 },
      { ticketId: 'tkt-19', reason: 'Same cause on a contractor account, assigned to Sam Oyelaran', confidence: 0.86 },
      { ticketId: 'tkt-22', reason: 'Same enforcement change, service account needs a token not an IdP redirect', confidence: 0.84 },
      { ticketId: 'tkt-20', reason: 'Not yet broken — asking whether the rollout will affect them', confidence: 0.82 },
      { ticketId: 'tkt-23', reason: 'Looks similar but the binary is missing, not the sign-in method — different root cause', confidence: 0.42 },
    ],
    activity: [
      {
        id: 'a1',
        actorId: 'agent',
        verb: 'suggested a 5-step plan',
        time: '2d ago',
        action: { label: 'View suggestion' },
      },
      {
        id: 'a2',
        actorId: 'agent',
        verb: 'matched this to',
        object: '7 open tickets',
        trailing: 'from the SSO enforcement rollout',
        time: '2d ago',
      },
      { id: 'a3', actorId: 'agent', verb: 'set SLA to', object: '2h', time: '2d ago' },
      {
        id: 'a4',
        actorId: 'agent',
        verb: 'added to queue',
        object: 'IT Requests',
        time: '2d ago',
      },
      {
        id: 'a5',
        actorId: 'aidan',
        verb: 'assigned to',
        object: 'Grant Fuhr',
        time: '2d ago',
      },
      {
        id: 'a6',
        actorId: 'aidan',
        verb: 'via Ask Agent',
        trailing: 'created a ticket',
        time: '2d ago',
        action: { label: 'View original conversation', icon: 'slack' },
      },
    ],
  },
  {
    id: 'tkt-2',
    key: 'TKT-AZURE-TALK-2601',
    title: 'Provision Candidate Take-Home — Interview Environment',
    status: 'open',
    priority: 'P3',
    queue: 'Procurement',
    assigneeId: 'devon',
    requesterId: 'devon',
    age: '1m',
    updated: 'Updated 1 minute ago',
    redacted: true,
    summary: [
      t(
        'A sandboxed take-home environment needs to be provisioned for an inbound candidate, with time-boxed credentials that expire after the interview window.',
      ),
    ],
    sla: okSla(),
    followerIds: ['devon'],
    related: [],
    activity: [
      { id: 'b1', actorId: 'agent', verb: 'added to queue', object: 'Procurement', time: '1m ago' },
    ],
  },
  {
    id: 'tkt-3',
    key: 'TKT-AZURE-TALK-2599',
    title: 'Add TinyFish Websearch as Sub Processor',
    status: 'open',
    priority: 'P2',
    queue: 'Security',
    assigneeId: 'sam',
    requesterId: 'priya',
    age: '2h',
    updated: 'Updated 2 hours ago',
    summary: [
      t('Legal needs TinyFish Websearch added to the published sub-processor list before the '),
      b('vendor review'),
      t(' closes. A DPA is already on file.'),
    ],
    sla: [
      { label: 'Response', value: '1h', state: 'at_risk', target: '2h' },
      { label: 'Resolution', value: '1d', state: 'ok', target: '2d', pausable: true },
    ],
    followerIds: ['sam', 'priya'],
    related: [],
    activity: [{ id: 'c1', actorId: 'priya', verb: 'created a ticket', time: '2h ago' }],
  },
  {
    id: 'tkt-4',
    key: 'TKT-AZURE-TALK-2588',
    title: 'Laptop replacement request — cracked display',
    status: 'open',
    priority: 'P2',
    queue: 'Hardware',
    assigneeId: 'grant',
    requesterId: 'mira',
    age: '5h',
    updated: 'Updated 5 hours ago',
    redacted: true,
    summary: [
      t('Display cracked after a drop. Device is still under warranty; a replacement can be '),
      b('shipped same-day'),
      t(' once the return label is issued.'),
    ],
    sla: [
      { label: 'Response', value: '2h', state: 'ok', target: '4h' },
      { label: 'Resolution', value: '5h', state: 'ok', target: '2d', pausable: true },
    ],
    slaPolicy: hardwareSla,
    followerIds: ['mira'],
    related: [],
    activity: [{ id: 'd1', actorId: 'mira', verb: 'created a ticket', time: '5h ago' }],
  },
  {
    id: 'tkt-7',
    key: 'TKT-AZURE-TALK-2564',
    title: 'Reinstate Google Workspace and Slack Accounts',
    status: 'open',
    priority: 'P1',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'devon',
    age: '1d',
    updated: 'Updated 1 day ago',
    summary: [
      t('Accounts were suspended during offboarding, but the contractor was '),
      b('re-engaged'),
      t(' this week. Both need reinstating without losing mail history.'),
    ],
    sla: [
      { label: 'Response', value: '+2h', state: 'breached', target: '1h' },
      { label: 'Resolution', value: '4h', state: 'at_risk', target: '8h', pausable: true },
    ],
    followerIds: ['devon', 'grant'],
    related: [],
    activity: [
      { id: 'g1', actorId: 'agent', verb: 'escalated to', object: 'P1', time: '1d ago' },
      { id: 'g2', actorId: 'devon', verb: 'created a ticket', time: '1d ago' },
    ],
  },
  {
    id: 'tkt-8',
    key: 'TKT-AZURE-TALK-2559',
    title: 'Add Search Bar to Company Website',
    status: 'open',
    priority: 'P3',
    queue: 'IT Requests',
    assigneeId: 'mira',
    requesterId: 'mira',
    age: '1d',
    updated: 'Updated 1 day ago',
    summary: [t('Marketing wants site-wide search. Needs scoping against the current CMS.')],
    sla: okSla(),
    followerIds: ['mira'],
    related: [],
    activity: [{ id: 'h1', actorId: 'mira', verb: 'created a ticket', time: '1d ago' }],
  },
  {
    id: 'tkt-9',
    key: 'TKT-AZURE-TALK-2551',
    title: 'Ashby Access Request – MIT Recruiting Su...',
    status: 'open',
    priority: 'P2',
    queue: 'Access & Identity',
    assigneeId: 'devon',
    requesterId: 'devon',
    age: '2d',
    updated: 'Updated 2 days ago',
    summary: [
      t('Recruiting coordinator needs '),
      b('interviewer-level'),
      t(' Ashby access for the MIT campus loop.'),
    ],
    sla: okSla(),
    followerIds: ['devon'],
    related: [],
    activity: [{ id: 'i1', actorId: 'devon', verb: 'created a ticket', time: '2d ago' }],
  },
  {
    id: 'tkt-10',
    key: 'TKT-AZURE-TALK-2544',
    title: 'Review: AEO/LLM Discoverability & Compe...',
    status: 'open',
    priority: 'P4',
    queue: 'IT Requests',
    assigneeId: 'mira',
    requesterId: 'priya',
    age: '2d',
    updated: 'Updated 2 days ago',
    summary: [t('Quarterly review of how the product surfaces in assistant answers.')],
    sla: okSla(),
    followerIds: ['mira'],
    related: [],
    activity: [{ id: 'j1', actorId: 'priya', verb: 'created a ticket', time: '2d ago' }],
  },
  {
    id: 'tkt-11',
    key: 'TKT-AZURE-TALK-2538',
    title: 'Approve Todoist Connector in Claude (jac...',
    status: 'open',
    priority: 'P3',
    queue: 'Security',
    assigneeId: 'sam',
    requesterId: 'mira',
    age: '2d',
    updated: 'Updated 2 days ago',
    summary: [
      t('Connector requests '),
      b('read-write'),
      t(' task scope. Security sign-off required before enabling org-wide.'),
    ],
    sla: okSla(),
    followerIds: ['sam'],
    related: [],
    activity: [{ id: 'k1', actorId: 'mira', verb: 'created a ticket', time: '2d ago' }],
  },
  {
    id: 'tkt-12',
    key: 'TKT-AZURE-TALK-2530',
    title: 'Add contractor group to Google Shared Dr...',
    status: 'open',
    priority: 'P3',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'devon',
    age: '3d',
    updated: 'Updated 3 days ago',
    redacted: true,
    summary: [t('Shared drive permissions need a contractor group rather than per-user grants.')],
    sla: okSla(),
    followerIds: ['devon'],
    related: [],
    activity: [{ id: 'l1', actorId: 'devon', verb: 'created a ticket', time: '3d ago' }],
  },
  {
    id: 'tkt-13',
    key: 'TKT-AZURE-TALK-2522',
    title: 'Monitor and dock for new starter desk setup',
    status: 'open',
    priority: 'P2',
    queue: 'Hardware',
    assigneeId: 'grant',
    requesterId: 'priya',
    age: '3d',
    updated: 'Updated 3 days ago',
    redacted: true,
    summary: [t('Standard desk bundle for a starter joining next Monday.')],
    sla: okSla(),
    followerIds: ['priya'],
    related: [],
    activity: [{ id: 'm1', actorId: 'priya', verb: 'created a ticket', time: '3d ago' }],
  },
  {
    id: 'tkt-14',
    key: 'TKT-AZURE-TALK-2510',
    title: 'VPN drops every 20 minutes on managed laptops',
    status: 'in_progress',
    priority: 'P1',
    queue: 'IT Requests',
    assigneeId: 'sam',
    requesterId: 'mira',
    age: '4d',
    updated: 'Updated 4 days ago',
    summary: [
      t('Session drops correlate with a '),
      b('certificate renewal'),
      t(' pushed by MDM last week. Rollback is staged.'),
    ],
    sla: [
      { label: 'Response', value: '15m', state: 'ok', target: '1h' },
      { label: 'Resolution', value: '+3h', state: 'breached', target: '8h', pausable: true },
    ],
    followerIds: ['sam', 'mira', 'grant'],
    related: [],
    activity: [{ id: 'n1', actorId: 'sam', verb: 'started work', time: '4d ago' }],
  },
  {
    id: 'tkt-15',
    key: 'TKT-AZURE-TALK-2498',
    title: 'Offboard departing analyst — revoke all access',
    status: 'on_hold',
    priority: 'P2',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'priya',
    age: '5d',
    updated: 'Updated 5 days ago',
    hold: {
      reason: 'awaiting_third_party',
      label: 'Waiting on People Ops to confirm the final working day',
      pausesSla: true,
      cadence: 'Nudge People Ops every 2 business days.',
    },
    summary: [
      t('Waiting on '),
      b('People Ops'),
      t(' to confirm the final working day before revoking SSO and vault access.'),
    ],
    sla: [
      { label: 'Response', value: '4h', state: 'ok', target: '4h' },
      { label: 'Resolution', value: '2d', state: 'paused', target: '5d', pausable: true },
    ],
    followerIds: ['grant', 'priya'],
    related: [],
    activity: [
      {
        id: 'o1',
        actorId: 'agent',
        verb: 'matched workflow',
        object: 'Offboard departing employee',
        time: '5d ago',
      },
    ],
  },

  /* ----------------------------------------------------------------
     SSO enforcement cohort. Seven tickets with one shared cause, plus
     tkt-23 — the near-miss that looks identical and isn't.
     ---------------------------------------------------------------- */
  {
    id: 'tkt-16',
    key: 'TKT-AZURE-TALK-2596',
    title: 'op read fails in CI — "password authentication is not supported"',
    status: 'open',
    priority: 'P2',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'nora',
    age: '6h',
    updated: 'Updated 6 hours ago',
    cohortId: 'sso-rollout',
    expected: { timeToResolve: '1h 40m', target: '2d', withinTarget: true },
    suggestion: ssoPlan({
      name: 'Nora Vance',
      first: 'Nora',
      email: 'nora@stlabs.com',
      devices: 2,
      requesterVerify: {
        label: 'Waiting on Nora to confirm the pipeline is green',
        followUp:
          'A CI runner signs in without a browser, so there is no IdP event to watch — Nora is asked instead.',
      },
      messageNote: 'For the deploy job: sign in once from the runner, then re-run the pipeline and tell us if it goes green.',
    }),
    summary: [
      t('The deploy pipeline reads secrets with '),
      c('op read'),
      t(' and started failing after enforcement. Non-interactive, so there is no browser to redirect to.'),
    ],
    sla: [
      { label: 'Response', value: '2h', state: 'at_risk', target: '4h' },
      { label: 'Resolution', value: '1d', state: 'ok', target: '2d', pausable: true },
    ],
    followerIds: ['nora', 'grant'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Same enforcement change — password auth disabled before IdP sign-in was configured',
        confidence: 0.94,
      },
    ],
    activity: [{ id: 'p1', actorId: 'nora', verb: 'created a ticket', time: '6h ago' }],
  },
  {
    id: 'tkt-17',
    key: 'TKT-AZURE-TALK-2593',
    title: 'On-call runbook broken — op signin still prompts for a password',
    status: 'open',
    priority: 'P1',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'kai',
    age: '9h',
    updated: 'Updated 9 hours ago',
    cohortId: 'sso-rollout',
    expected: { timeToResolve: '2h 5m', target: '4h', withinTarget: true },
    suggestion: ssoPlan({
      name: 'Kai Oduya',
      first: 'Kai',
      email: 'kai@stlabs.io',
      devices: 2,
      emailMismatch: { correct: 'kai@stlabs.com' },
    }),
    summary: [
      t('Step 2 of the on-call runbook cannot be completed, so the rotation cannot reach production credentials. '),
      b('Escalated'),
      t(' because it blocks incident response.'),
    ],
    sla: [
      { label: 'Response', value: '+1h', state: 'breached', target: '30m' },
      { label: 'Resolution', value: '2h', state: 'at_risk', target: '4h', pausable: true },
    ],
    followerIds: ['kai', 'grant', 'nora'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Identical error text and the same missing IdP CLI configuration',
        confidence: 0.96,
      },
    ],
    activity: [
      { id: 'q1', actorId: 'agent', verb: 'escalated to', object: 'P1', time: '8h ago' },
      { id: 'q2', actorId: 'kai', verb: 'created a ticket', time: '9h ago' },
    ],
  },
  {
    id: 'tkt-18',
    key: 'TKT-AZURE-TALK-2591',
    title: 'Desktop 1Password works but the CLI will not sign in',
    status: 'open',
    priority: 'P3',
    queue: 'IT Requests',
    assigneeId: 'grant',
    requesterId: 'mira',
    age: '11h',
    updated: 'Updated 11 hours ago',
    cohortId: 'sso-rollout',
    expected: { timeToResolve: '1d 1h', target: '2d', withinTarget: true },
    suggestion: ssoPlan({
      name: 'Mira Chen',
      first: 'Mira',
      email: 'mira@stlabs.com',
      devices: 1,
      enrollFault: {
        label: 'Pending device approval',
        detail:
          "Mira's account has a new device waiting for approval. Enrollment cannot apply until it is approved or removed — that is Mira's call, not the agent's.",
        attempts: 2,
      },
    }),
    summary: [
      t('The desktop app signed in through Google without complaint, which is why this was filed as a CLI bug rather than an access problem.'),
    ],
    sla: okSla(),
    followerIds: ['mira'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Desktop enrollment applied, CLI IdP sign-in never configured — same cause',
        confidence: 0.88,
      },
    ],
    activity: [{ id: 'r1', actorId: 'mira', verb: 'created a ticket', time: '11h ago' }],
  },
  {
    id: 'tkt-19',
    key: 'TKT-AZURE-TALK-2587',
    title: 'Contractor cannot reach the data vault after the SSO change',
    status: 'open',
    priority: 'P4',
    queue: 'Access & Identity',
    assigneeId: 'sam',
    requesterId: 'theo',
    age: '1d',
    updated: 'Updated 1 day ago',
    cohortId: 'sso-rollout',
    suggestion: ssoPlan({
      name: 'Theo Brandt',
      first: 'Theo',
      email: 'theo@stlabs.com',
      devices: 1,
    }),
    summary: [
      t('Contractor account, '),
      b('assigned to Sam'),
      t(' rather than Grant — the same fix applies but the ticket is not Grant’s to resolve.'),
    ],
    sla: okSla(),
    followerIds: ['theo', 'sam'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Same cause on a contractor account — owned by Sam Oyelaran, not Grant',
        confidence: 0.86,
      },
    ],
    activity: [{ id: 's1', actorId: 'theo', verb: 'created a ticket', time: '1d ago' }],
  },
  {
    id: 'tkt-20',
    key: 'TKT-AZURE-TALK-2584',
    title: 'Will the SSO enforcement rollout break my scripts?',
    status: 'open',
    priority: 'P5',
    queue: 'IT Requests',
    assigneeId: 'grant',
    requesterId: 'devon',
    age: '1d',
    updated: 'Updated 1 day ago',
    cohortId: 'sso-rollout',
    summary: [
      t('Nothing is broken yet. Asked ahead of time, which makes this the '),
      b('preventive'),
      t(' case — the answer is the same reply the rest of the cohort is getting.'),
    ],
    sla: okSla(),
    followerIds: ['devon'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Same rollout, not yet affected — candidate for the pre-emptive notice',
        confidence: 0.82,
      },
    ],
    activity: [{ id: 't1', actorId: 'devon', verb: 'created a ticket', time: '1d ago' }],
  },
  {
    id: 'tkt-21',
    key: 'TKT-AZURE-TALK-2580',
    title: '1Password CLI sign-in loop on a managed laptop',
    status: 'on_hold',
    priority: 'P3',
    queue: 'Access & Identity',
    assigneeId: 'grant',
    requesterId: 'priya',
    age: '2d',
    updated: 'Updated 2 days ago',
    cohortId: 'sso-rollout',
    expected: { timeToResolve: '1d 6h', target: '2d', withinTarget: true },
    suggestion: ssoPlan({
      name: 'Priya Nair',
      first: 'Priya',
      email: 'priya@stlabs.com',
      devices: 1,
    }),
    hold: {
      reason: 'awaiting_requester',
      label: 'Waiting on Priya to send the CLI version',
      pausesSla: true,
      cadence: 'Nudged once. One nudge left before auto-resolve.',
      ask: {
        title: 'Send us your 1Password CLI version',
        detail: [t('Run '), c('op --version'), t(' in your terminal and paste what it prints.')],
      },
    },
    summary: [
      t('Browser opens, completes, and the CLI asks again. Already '),
      b('on hold'),
      t(' pending a version string — the resolution clock is paused.'),
    ],
    sla: [
      { label: 'Response', value: '3h', state: 'ok', target: '4h' },
      { label: 'Resolution', value: '1d 4h', state: 'paused', target: '2d', pausable: true },
    ],
    followerIds: ['priya', 'grant'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Same cohort and cause; already waiting on the requester',
        confidence: 0.9,
      },
    ],
    activity: [
      {
        id: 'u1',
        actorId: 'grant',
        verb: 'put this',
        object: 'on hold',
        time: '1d ago',
        portal: { verb: 'put this on hold —', object: 'Send us your 1Password CLI version' },
      },
    ],
  },
  {
    id: 'tkt-22',
    key: 'TKT-AZURE-TALK-2575',
    title: 'Service account locked out of the billing vault',
    status: 'open',
    priority: 'P2',
    queue: 'Security',
    assigneeId: 'grant',
    requesterId: 'sam',
    age: '2d',
    updated: 'Updated 2 days ago',
    cohortId: 'sso-rollout',
    summary: [
      t('A service account cannot complete an interactive redirect. Same trigger as the rest of the cohort, but the fix is a '),
      b('service-account token'),
      t(', not enrollment.'),
    ],
    sla: [
      { label: 'Response', value: '4h', state: 'ok', target: '4h' },
      { label: 'Resolution', value: '1d 2h', state: 'at_risk', target: '2d', pausable: true },
    ],
    followerIds: ['sam', 'grant'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Same enforcement change; needs a token rather than an IdP redirect',
        confidence: 0.84,
      },
    ],
    activity: [{ id: 'v1', actorId: 'sam', verb: 'created a ticket', time: '2d ago' }],
  },
  {
    id: 'tkt-23',
    key: 'TKT-AZURE-TALK-2569',
    title: 'op: command not found after a Homebrew upgrade',
    status: 'open',
    priority: 'P3',
    queue: 'IT Requests',
    assigneeId: 'grant',
    requesterId: 'nora',
    age: '3d',
    updated: 'Updated 3 days ago',
    summary: [
      t('Reads as another CLI sign-in failure, but the binary is gone from '),
      c('$PATH'),
      t(' — '),
      b('not'),
      t(' an SSO problem. Listed as related, deliberately not in the cohort.'),
    ],
    sla: okSla(),
    followerIds: ['nora'],
    related: [
      {
        ticketId: 'tkt-1',
        reason: 'Surface symptom matches, root cause does not — missing binary, not sign-in method',
        confidence: 0.42,
      },
    ],
    activity: [{ id: 'w1', actorId: 'nora', verb: 'created a ticket', time: '3d ago' }],
  },
]

/**
 * Tickets that do not exist at page load. tkt-24 is filed *after* Grant saves
 * the SSO resolution as a workflow, and is matched and resolved by the agent
 * with no human touch — the payoff beat. Kept out of `tickets` so no count,
 * cohort size or list includes it until it actually arrives.
 */
export const lateTickets: Ticket[] = [
  {
    id: 'tkt-24',
    key: 'TKT-AZURE-TALK-2618',
    title: 'op signin asks for a password I no longer have',
    status: 'open',
    priority: 'P3',
    queue: 'IT Requests',
    assigneeId: 'agent',
    requesterId: 'ines',
    age: 'now',
    updated: 'Updated just now',
    cohortId: 'sso-rollout',
    expected: { timeToResolve: '6m', target: '2d', withinTarget: true },
    summary: [
      t('Filed after the SSO resolution was saved as a workflow. The agent matched it, ran it, and verified it — '),
      b('no human touched it'),
      t('.'),
    ],
    suggestion: ssoPlan({ name: 'Ines Duarte', first: 'Ines', email: 'ines@stlabs.com', devices: 2 }),
    sla: [
      { label: 'Response', value: '1m', state: 'ok', target: '4h' },
      { label: 'Resolution', value: '6m', state: 'ok', target: '2d', pausable: true },
    ],
    followerIds: ['ines'],
    related: [],
    activity: [{ id: 'x1', actorId: 'ines', verb: 'via Ask Agent', trailing: 'created a ticket', time: 'just now' }],
  },
]

const byId = new Map([...tickets, ...lateTickets].map((ticket) => [ticket.id, ticket]))

export function getTicket(id: string): Ticket | undefined {
  return byId.get(id)
}

/** Statuses that still need somebody's attention. */
const ACTIVE: ReadonlySet<Ticket['status']> = new Set(['open', 'in_progress', 'on_hold'])

export function isActive(status: Ticket['status']): boolean {
  return ACTIVE.has(status)
}

export const openCount = tickets.filter((ticket) => isActive(ticket.status)).length

/** Tickets sharing a cohort id, showcase ticket included. */
export function cohortTickets(cohortId: string): Ticket[] {
  return tickets.filter((ticket) => ticket.cohortId === cohortId)
}

/* ------------------------------------------------------------------
   DEV-only fixture-drift detection. There is no test framework here,
   so this is the cheapest way to catch a related-link that points at a
   deleted ticket or isn't reciprocated.
   ------------------------------------------------------------------ */
if (import.meta.env?.DEV) {
  for (const ticket of tickets) {
    for (const link of ticket.related) {
      const other = byId.get(link.ticketId)
      if (!other) {
        console.warn(`[fixtures] ${ticket.id} links to unknown ticket ${link.ticketId}`)
        continue
      }
      if (!other.related.some((back) => back.ticketId === ticket.id)) {
        console.warn(`[fixtures] ${ticket.id} → ${other.id} is not reciprocated`)
      }
    }
  }
}
