/**
 * Minutes from an authored duration like `2h`, `1d`, `1h 12m`. Returns
 * `undefined` for anything it cannot parse — a clock reading such as `+1d`
 * ("a day past due") is deliberately not a duration.
 *
 * This exists for exactly one comparison: an overridden resolution target has
 * to be scored against the authored time-to-resolve, otherwise changing the
 * target would leave the resolve summary saying "within" when it is not.
 */
const UNITS: Record<string, number> = { m: 1, h: 60, d: 60 * 24 }

export function toMinutes(value: string): number | undefined {
  const matches = value.trim().toLowerCase().match(/^(\d+\s*[mhd])(\s+\d+\s*[mhd])*$/)
  if (!matches) return undefined
  let total = 0
  for (const part of value.trim().toLowerCase().matchAll(/(\d+)\s*([mhd])/g)) {
    total += Number(part[1]) * UNITS[part[2]]
  }
  return total
}

/** `actual <= target`, or `undefined` when either side is not a duration. */
export function withinTarget(actual: string, target: string): boolean | undefined {
  const a = toMinutes(actual)
  const b = toMinutes(target)
  if (a === undefined || b === undefined) return undefined
  return a <= b
}
