// Test fixtures for accounts.
import type { Database } from 'remix/data-table'

import type { User } from '../app/data/tables.ts'
import { createUser, setUserStatus } from '../app/data/users.ts'

/** Creates an active (validated) account. */
export async function createActiveUser(db: Database, name: string, email: string): Promise<User> {
  const user = await createUser(db, { name, email })
  return setUserStatus(db, user.id, 'active')
}
