import type { Workflow } from './types'

/**
 * Workflow catalogue. The "N available" counter in the ticket detail is
 * derived from this list, so adding one here updates the UI.
 *
 * Ids are authored, not index-derived: `suggestion.workflowIds` references
 * them, so an insert in the middle must not renumber everything after it.
 */
const raw: Array<[id: string, name: string, category: string]> = [
  ['wf-reset-password', 'Reset password', 'Identity'],
  ['wf-enroll-sso', 'Enroll user in SSO', 'Identity'],
  ['wf-verify-enrollment', 'Verify SSO enrollment', 'Identity'],
  ['wf-profile-email', 'Correct 1Password profile email', 'Identity'],
  ['wf-revoke-session', 'Revoke SSO session', 'Identity'],
  ['wf-rotate-api-key', 'Rotate API key', 'Identity'],
  ['wf-unlock-account', 'Unlock account', 'Identity'],
  ['wf-okta-group-add', 'Add to Okta group', 'Identity'],
  ['wf-okta-group-remove', 'Remove from Okta group', 'Identity'],
  ['wf-provision-vault', 'Provision 1Password vault', 'Identity'],
  ['wf-drive-access', 'Grant Google Drive access', 'Access'],
  ['wf-slack-access', 'Grant Slack channel access', 'Access'],
  ['wf-github-access', 'Grant GitHub repo access', 'Access'],
  ['wf-figma-seat', 'Grant Figma seat', 'Access'],
  ['wf-notion-access', 'Grant Notion workspace access', 'Access'],
  ['wf-ashby-access', 'Request Ashby access', 'Access'],
  ['wf-linear-seat', 'Request Linear seat', 'Access'],
  ['wf-admin-elevation', 'Request admin elevation', 'Access'],
  ['wf-order-laptop', 'Order MacBook Pro', 'Hardware'],
  ['wf-order-monitor', 'Order monitor + dock', 'Hardware'],
  ['wf-ship-keyboard', 'Ship replacement keyboard', 'Hardware'],
  ['wf-collect-device', 'Collect returned device', 'Hardware'],
  ['wf-enroll-mdm', 'Enroll device in MDM', 'Hardware'],
  ['wf-wipe-device', 'Wipe and reassign device', 'Hardware'],
  ['wf-replace-battery', 'Replace battery', 'Hardware'],
  ['wf-zoom-upgrade', 'Upgrade Zoom license', 'Licensing'],
  ['wf-zoom-downgrade', 'Downgrade Zoom license', 'Licensing'],
  ['wf-reclaim-seats', 'Reclaim unused seats', 'Licensing'],
  ['wf-renew-contract', 'Renew annual contract', 'Licensing'],
  ['wf-sub-processor', 'Add sub-processor', 'Compliance'],
  ['wf-access-review', 'Run access review', 'Compliance'],
  ['wf-audit-log', 'Export audit log', 'Compliance'],
  ['wf-security-exception', 'File security exception', 'Compliance'],
  ['wf-onboard', 'Onboard new hire', 'Lifecycle'],
  ['wf-offboard', 'Offboard departing employee', 'Lifecycle'],
  ['wf-transfer-ownership', 'Transfer team ownership', 'Lifecycle'],
  ['wf-contractor-to-fte', 'Convert contractor to FTE', 'Lifecycle'],
  ['wf-escalate-oncall', 'Escalate to on-call', 'Triage'],
  ['wf-merge-duplicates', 'Merge duplicate tickets', 'Triage'],
]

export const workflows: Workflow[] = raw.map(([id, name, category]) => ({
  id,
  name,
  category,
}))

const byId = new Map(workflows.map((w) => [w.id, w]))

export function getWorkflow(id: string): Workflow | undefined {
  return byId.get(id)
}
