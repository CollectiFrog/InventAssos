// Data access for responsibles: the only module that reads or writes `responsibles`.
import { type Database, sql } from 'remix/data-table'

import { type Responsible, type ResponsibleStatus, responsibles } from './tables.ts'

/** The row linking a person to a collectif, whatever its status. */
export async function findResponsible(
  db: Database,
  userId: string,
  collectifId: string,
): Promise<Responsible | null> {
  return db.findOne(responsibles, { where: { user_id: userId, collectif_id: collectifId } })
}

/** Creates or overwrites the link between a person and a collectif. */
export async function setResponsible(
  db: Database,
  input: {
    userId: string
    collectifId: string
    status: ResponsibleStatus
    validatedBy?: string | null
  },
): Promise<void> {
  const validated = input.status === 'pending' ? null : new Date()
  const row = {
    status: input.status,
    validated_by: input.validatedBy ?? null,
    validated_at: validated,
    ...(input.status === 'pending' ? { requested_at: new Date() } : {}),
  }
  await db
    .query(responsibles)
    .upsert(
      { user_id: input.userId, collectif_id: input.collectifId, ...row },
      { conflictTarget: ['user_id', 'collectif_id'], update: row },
    )
}

/** IDs of the active collectifs a person is an active responsible of. */
export async function listManagedCollectifIds(db: Database, userId: string): Promise<string[]> {
  const result = await db.exec(sql`
    select r.collectif_id from responsibles r
    join collectifs c on c.id = r.collectif_id
    where r.user_id = ${userId} and r.status = 'active' and c.status = 'active'
  `)
  return (result.rows ?? []).map((row) => String(row.collectif_id))
}
