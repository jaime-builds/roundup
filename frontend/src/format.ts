// SQLite stores timestamps as UTC "YYYY-MM-DD HH:MM:SS". Render them locally.

export function formatDate(s: string): string {
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
