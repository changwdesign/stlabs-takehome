/**
 * Fake-async pacing. Raise to slow every agent run down for a walkthrough,
 * lower to make a self-test quick. Nothing else in the app reads wall time.
 */
export const DEMO_SPEED = 1

export function scaled(ms: number): number {
  return Math.max(120, Math.round(ms * DEMO_SPEED))
}

/** Default run length for a step that doesn't author its own. */
export const DEFAULT_RUN_MS = 2000

/** Gap between bulk-run items starting, so the list advances as a wave. */
export const ITEM_STAGGER_MS = 900

/** How long after a workflow is saved the next matching ticket is filed. */
export const ARRIVAL_MS = 2500
