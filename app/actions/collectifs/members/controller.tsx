import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findActiveCollectifBySlug } from '../../../data/collectifs.ts'
import { decideMembership, findMembership } from '../../../data/members.ts'
import type { Collectif, MembershipStatus, User } from '../../../data/tables.ts'
import { findUserById } from '../../../data/users.ts'
import { type Mail, sendSafely } from '../../../mail/mailer.ts'
import {
  membershipApprovedMail,
  membershipRejectedMail,
  membershipRemovedMail,
} from '../../../mail/messages.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canManageMembers } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { forbidden, notFound, requireUser } from '../../guards.tsx'

/** What each decision expects of the row, sets, logs, mails and tells the responsible. */
const decisions = {
  approve: {
    from: 'pending',
    to: 'active',
    action: 'member.approved',
    mail: (user: User, collectif: Collectif, url: string) =>
      membershipApprovedMail(user.email, collectif.name, url),
    notice: (user: User) => `${user.name} est maintenant membre ; un e-mail l’a prévenu.`,
  },
  reject: {
    from: 'pending',
    to: 'rejected',
    action: 'member.rejected',
    mail: (user: User, collectif: Collectif) => membershipRejectedMail(user.email, collectif.name),
    notice: (user: User) => `Demande de ${user.name} refusée ; un e-mail l’a prévenu.`,
  },
  remove: {
    from: 'active',
    to: 'removed',
    action: 'member.removed',
    mail: (user: User, collectif: Collectif) => membershipRemovedMail(user.email, collectif.name),
    notice: (user: User) => `${user.name} ne fait plus partie du collectif.`,
  },
} satisfies Record<
  string,
  {
    from: MembershipStatus
    to: MembershipStatus
    action: string
    mail: (user: User, collectif: Collectif, url: string) => Mail
    notice: (user: User) => string
  }
>

/**
 * Applies a responsible's decision on a member (US-0.8.4). Only rows with the member role are
 * touched: responsibles are named and removed with US-0.8.6.
 */
async function decide(
  context: AppContext,
  params: { slug: string; userId: string },
  kind: keyof typeof decisions,
) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor

  const { db, mailer, session, settings } = context
  const collectif = await findActiveCollectifBySlug(db, params.slug)
  if (collectif === null) return notFound(context)
  if (!canManageMembers(actor, collectif.id)) return forbidden(context)

  const decision = decisions[kind]
  const membersUrl = routes.collectifs.people.href({ slug: collectif.slug })
  const row = await findMembership(db, params.userId, collectif.id)
  const user = await findUserById(db, params.userId)
  if (row?.role !== 'member' || row.status !== decision.from || user === null) {
    session.flash('notice', 'Cette demande a déjà été traitée.')
    return redirect(membersUrl, 303)
  }

  await db.transaction(async (tx) => {
    await decideMembership(tx, {
      userId: user.id,
      collectifId: collectif.id,
      status: decision.to,
      decidedBy: actor.id,
    })
    await logAction(tx, {
      actorId: actor.id,
      action: decision.action,
      entity: 'collectif',
      entityId: collectif.id,
      payload: { userId: user.id },
    })
  })
  const showUrl = settings.appUrl + routes.collectifs.show.href({ slug: collectif.slug })
  await sendSafely(mailer, decision.mail(user, collectif, showUrl))
  session.flash('notice', decision.notice(user))
  return redirect(membersUrl, 303)
}

/** Responsibles accept, reject and remove the members of their collectif (US-0.8.4). */
export default createController(routes.collectifs.members, {
  actions: {
    approve: (context) => decide(context, context.params, 'approve'),
    reject: (context) => decide(context, context.params, 'reject'),
    remove: (context) => decide(context, context.params, 'remove'),
  },
})
