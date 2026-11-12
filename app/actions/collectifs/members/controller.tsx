import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { logAction } from '../../../data/audit-log.ts'
import { findActiveCollectifBySlug } from '../../../data/collectifs.ts'
import {
  countActiveResponsiblesForUpdate,
  decideMembership,
  findMembership,
  setMembershipRole,
} from '../../../data/members.ts'
import type { Collectif, MembershipStatus, User } from '../../../data/tables.ts'
import { findUserById } from '../../../data/users.ts'
import { type Mail, sendSafely } from '../../../mail/mailer.ts'
import {
  membershipApprovedMail,
  membershipRejectedMail,
  membershipRemovedMail,
  responsibleDemotedMail,
  responsibleNamedMail,
} from '../../../mail/messages.ts'
import type { AppContext } from '../../../middleware/index.ts'
import { canLeaveCollectif, canManageMembers, canNameResponsibles } from '../../../permissions.ts'
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
    notice: (user: User) => `${user.name} est maintenant membre ; un e-mail l’en informe.`,
  },
  reject: {
    from: 'pending',
    to: 'rejected',
    action: 'member.rejected',
    mail: (user: User, collectif: Collectif) => membershipRejectedMail(user.email, collectif.name),
    notice: (user: User) => `Demande de ${user.name} refusée ; un e-mail l’en informe.`,
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

/** Thrown inside a transaction to roll it back when it would leave C without a responsible. */
class LastResponsible extends Error {}

/** Locks C's responsibles and refuses to go on if the one leaving the role is the last one. */
async function keepOneResponsible(db: AppContext['db'], collectifId: string): Promise<void> {
  if ((await countActiveResponsiblesForUpdate(db, collectifId)) <= 1) throw new LastResponsible()
}

/**
 * Makes a member responsible, or a responsible a member again (US-0.8.6). A responsible of C, an
 * admin or a moderator decides; C always keeps one responsible, and a removed one stays a member.
 */
async function changeRole(
  context: AppContext,
  params: { slug: string; userId: string },
  role: 'responsible' | 'member',
) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor

  const { db, mailer, session, settings } = context
  const collectif = await findActiveCollectifBySlug(db, params.slug)
  if (collectif === null) return notFound(context)
  if (!canNameResponsibles(actor, collectif.id)) return forbidden(context)

  const membersUrl = routes.collectifs.people.href({ slug: collectif.slug })
  const row = await findMembership(db, params.userId, collectif.id)
  const user = await findUserById(db, params.userId)
  const from = role === 'responsible' ? 'member' : 'responsible'
  if (row?.status !== 'active' || row.role !== from || user?.status !== 'active') {
    session.flash('notice', 'Ce changement a déjà été fait.')
    return redirect(membersUrl, 303)
  }

  try {
    await db.transaction(async (tx) => {
      if (role === 'member') await keepOneResponsible(tx, collectif.id)
      await setMembershipRole(tx, {
        userId: user.id,
        collectifId: collectif.id,
        role,
        decidedBy: actor.id,
      })
      await logAction(tx, {
        actorId: actor.id,
        action: role === 'responsible' ? 'responsible.named' : 'responsible.removed',
        entity: 'collectif',
        entityId: collectif.id,
        payload: { userId: user.id },
      })
    })
  } catch (error) {
    if (!(error instanceof LastResponsible)) throw error
    session.flash(
      'notice',
      'C’est le dernier responsable : nommez d’abord un autre membre responsable.',
    )
    return redirect(membersUrl, 303)
  }

  const showUrl = settings.appUrl + routes.collectifs.show.href({ slug: collectif.slug })
  await sendSafely(
    mailer,
    role === 'responsible'
      ? responsibleNamedMail(user.email, collectif.name, showUrl)
      : responsibleDemotedMail(user.email, collectif.name),
  )
  session.flash(
    'notice',
    role === 'responsible'
      ? `${user.name} est maintenant responsable.`
      : `${user.name} n’est plus responsable et reste membre.`,
  )
  return redirect(membersUrl, 303)
}

/** Leaves a collectif (US-0.8.8); the last responsible names another one first. */
async function leave(context: AppContext, slug: string) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor

  const { db, session } = context
  const collectif = await findActiveCollectifBySlug(db, slug)
  if (collectif === null) return notFound(context)
  if (!canLeaveCollectif(actor, collectif.id)) return forbidden(context)

  const row = await findMembership(db, actor.id, collectif.id)
  try {
    await db.transaction(async (tx) => {
      if (row?.role === 'responsible') await keepOneResponsible(tx, collectif.id)
      await decideMembership(tx, {
        userId: actor.id,
        collectifId: collectif.id,
        status: 'removed',
        decidedBy: actor.id,
      })
      await logAction(tx, {
        actorId: actor.id,
        action: 'member.left',
        entity: 'collectif',
        entityId: collectif.id,
        payload: { userId: actor.id },
      })
    })
  } catch (error) {
    if (!(error instanceof LastResponsible)) throw error
    session.flash(
      'notice',
      'Vous êtes le dernier responsable : nommez d’abord un membre responsable pour pouvoir partir.',
    )
    return redirect(routes.collectifs.people.href({ slug: collectif.slug }), 303)
  }
  session.flash('notice', `Vous avez quitté « ${collectif.name} ».`)
  return redirect(routes.collectifs.index.href(), 303)
}

/**
 * Responsibles accept, reject and remove the members of their collectif (US-0.8.4) and name its
 * responsibles (US-0.8.6); anyone of the collectif may leave it (US-0.8.8).
 */
export default createController(routes.collectifs.members, {
  actions: {
    approve: (context) => decide(context, context.params, 'approve'),
    reject: (context) => decide(context, context.params, 'reject'),
    remove: (context) => decide(context, context.params, 'remove'),
    promote: (context) => changeRole(context, context.params, 'responsible'),
    demote: (context) => changeRole(context, context.params, 'member'),
    leave: (context) => leave(context, context.params.slug),
  },
})
