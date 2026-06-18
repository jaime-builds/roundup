// Tiny input-validation helpers for request bodies and route params.

// A non-empty trimmed string, or null if invalid/blank.
export function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length > 0 ? t : null
}

// A positive integer id, or null.
export function asId(v: unknown): number | null {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

// A boolean, or null if not a boolean.
export function asBool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null
}
