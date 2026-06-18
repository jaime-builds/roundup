// Authorization helpers shared across routes.

import { getListById, userCanAccessProject } from './repo'
import type { ListRow } from './types'

// Load a list only if the user can access its project. Returns undefined for both
// "does not exist" and "no access" so callers can answer 404 without leaking which.
export function loadAccessibleList(userId: number, listId: number): ListRow | undefined {
  const list = getListById(listId)
  if (!list) return undefined
  if (!userCanAccessProject(userId, list.project_id)) return undefined
  return list
}
