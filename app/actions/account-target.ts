import type { Database } from 'remix/data-table'

import type { User } from '../data/tables.ts'
import { findUserById } from '../data/users.ts'
import type { AccountTarget } from '../permissions.ts'

/** The account as the staff rules see it: who it is and which platform role it holds. */
export function accountTargetOf(user: User, adminEmails: ReadonlySet<string>): AccountTarget {
  return {
    id: user.id,
    isListedAdmin: adminEmails.has(user.email),
    isNamedAdmin: user.role === 'admin',
    isModerator: user.role === 'moderator',
  }
}

/** The person who owns an item, as an account target; null when a collectif owns it. */
export async function itemOwnerAccount(
  db: Database,
  item: { owner_user_id: string | null },
  adminEmails: ReadonlySet<string>,
): Promise<AccountTarget | null> {
  const owner = item.owner_user_id ? await findUserById(db, item.owner_user_id) : null
  return owner ? accountTargetOf(owner, adminEmails) : null
}
