import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'
import { logAction } from '../../data/audit-log.ts'
import {
  findActiveCollectifBySlug,
  listPendingRequestsBy,
  searchActiveCollectifs,
} from '../../data/collectifs.ts'
import { listDeletionRequests } from '../../data/deletion-requests.ts'
import { listItemsDepositedAt, listItemsOwnedBy } from '../../data/items.ts'
import { listCollectifLocations, redactLocation } from '../../data/locations.ts'
import {
  findMembership,
  listCollectifPeople,
  listMembershipRequests,
  listResponsibleEmails,
  requestMembership,
  setResponsible,
} from '../../data/members.ts'
import { sendSafely } from '../../mail/mailer.ts'
import { membershipRequestMail, newResponsibleRequestMail } from '../../mail/messages.ts'
import type { AppContext } from '../../middleware/index.ts'
import {
  canAssignItemOwner,
  canDecideItemDeletion,
  canEditCollectif,
  canExportInventoryOf,
  canManageCollectifLocations,
  canManageMembers,
  canManageResponsibles,
  canNameResponsibles,
  canRequestMembership,
  canRequestResponsibility,
  canSeeCollectifInventory,
  canSeeFullAddress,
  isValidatedUser,
  itemScopeOf,
} from '../../permissions.ts'
import { hitUserRequest, notifyAdmins } from '../../rate-limits.ts'
import { routes } from '../../routes.ts'
import { parseItemSort, parseItemView } from '../../ui/item-table.tsx'
import { backHref } from '../back-link.ts'
import { forbidden, notFound, requireUser, tooManyRequests } from '../guards.tsx'
import { viewerOf } from '../viewer.ts'
import { CollectifPage, type CollectifTab, type Membership } from './collectif-page.tsx'
import { CollectifsPage } from './collectifs-pages.tsx'

/** A collectif's page on one of its tabs (US-0.7.5); outsiders get its directory entry only. */
async function renderCollectif(context: AppContext, slug: string, tab: CollectifTab) {
  const actor = requireUser(context)
  if (actor instanceof Response) return actor
  if (!isValidatedUser(actor)) return forbidden(context)

  const { db } = context
  const collectif = await findActiveCollectifBySlug(db, slug)
  if (collectif === null) return notFound(context)

  const link = await findMembership(db, actor.id, collectif.id)
  const membership: Membership =
    link?.status === 'active'
      ? link.role
      : link?.status === 'pending'
        ? link.role === 'member'
          ? 'pendingMember'
          : 'pendingResponsible'
        : 'none'
  const managesMembers = canManageMembers(actor, collectif.id)
  const notice = context.session.get('notice')
  // Outsiders get the directory entry only: no equipment, locations or people (ADR 0021).
  const inside = canSeeCollectifInventory(actor, collectif.id)
  const scope = itemScopeOf(actor)
  const params = context.url.searchParams
  const sort = parseItemSort(params.get('tri'))
  const owner = { collectifId: collectif.id }
  const items = inside ? await listItemsOwnedBy(db, owner, scope, sort) : []
  // Same tab URL with some parameters changed (sort, view).
  const hrefWith = (changes: Record<string, string>) => {
    const query = new URLSearchParams(params)
    for (const [name, value] of Object.entries(changes)) {
      if (value) query.set(name, value)
      else query.delete(name)
    }
    const search = query.toString()
    return search ? `${context.url.pathname}?${search}` : context.url.pathname
  }
  return context.render(
    <CollectifPage
      viewer={viewerOf(context)}
      csrfToken={getCsrfToken(context)}
      collectif={collectif}
      tab={tab}
      back={backHref(context, routes.collectifs.index.href())}
      inside={inside}
      membership={membership}
      canEdit={canEditCollectif(actor, collectif.id)}
      canAddItems={canAssignItemOwner(actor, { collectifId: collectif.id })}
      canManageLocations={canManageCollectifLocations(actor, collectif.id)}
      canManageResponsibles={canManageResponsibles(actor)}
      canManageMembers={managesMembers}
      canNameResponsibles={canNameResponsibles(actor, collectif.id)}
      canExport={canExportInventoryOf(actor, { collectifId: collectif.id })}
      viewerId={actor.id}
      items={items}
      sort={sort}
      view={parseItemView(params.get('vue'))}
      hrefWith={hrefWith}
      deposits={
        inside && tab === 'items' ? await listItemsDepositedAt(db, collectif.id, scope) : []
      }
      locations={
        inside && tab === 'places'
          ? (await listCollectifLocations(db, collectif.id)).map((location) =>
              redactLocation(location, canSeeFullAddress(actor, location)),
            )
          : []
      }
      people={inside && tab === 'people' ? await listCollectifPeople(db, collectif.id) : []}
      // Loaded on every tab: the Membres tab's label counts what waits for its responsibles.
      requests={managesMembers ? await listMembershipRequests(db, collectif.id) : []}
      deletionRequests={
        canDecideItemDeletion(actor, collectif.id)
          ? await listDeletionRequests(db, collectif.id)
          : []
      }
      notice={typeof notice === 'string' ? notice : undefined}
    />,
  )
}

/** The collectifs directory (US-0.7.12) and a collectif's page. */
export default createController(routes.collectifs, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!isValidatedUser(actor)) return forbidden(context)

      const { db } = context
      const query = context.url.searchParams.get('q')?.trim().slice(0, 100) ?? ''
      const all = await searchActiveCollectifs(db)
      const matching = query ? await searchActiveCollectifs(db, query) : all
      const isMine = (c: { id: string }) => actor.memberCollectifIds.has(c.id)
      const notice = context.session.get('notice')
      return context.render(
        <CollectifsPage
          viewer={viewerOf(context)}
          mine={all.filter(isMine)}
          others={matching.filter((c) => !isMine(c))}
          query={query}
          myRequests={await listPendingRequestsBy(db, actor.id)}
          notice={typeof notice === 'string' ? notice : undefined}
        />,
      )
    },

    show: (context) => renderCollectif(context, context.params.slug, 'items'),
    places: (context) => renderCollectif(context, context.params.slug, 'places'),
    people: (context) => renderCollectif(context, context.params.slug, 'people'),
    oldPeople: (context) =>
      redirect(routes.collectifs.people.href({ slug: context.params.slug }), 301),

    // US-0.3.3: one open request per person and collectif; a rejected or removed person may ask again.
    async requestResponsibility(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor

      const { db, mailer, settings, session } = context
      const collectif = await findActiveCollectifBySlug(db, context.params.slug)
      if (collectif === null) return notFound(context)
      if (!canRequestResponsibility(actor, collectif.id)) return forbidden(context)

      const showUrl = routes.collectifs.show.href({ slug: collectif.slug })
      const existing = await findMembership(db, actor.id, collectif.id)
      if (existing?.status === 'pending') {
        session.flash('notice', 'Vous avez déjà une demande en cours pour ce collectif.')
        return redirect(showUrl, 303)
      }

      const limit = await hitUserRequest(db, settings, actor.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      await setResponsible(db, { userId: actor.id, collectifId: collectif.id, status: 'pending' })
      const reviewUrl = settings.appUrl + routes.admin.index.href()
      await notifyAdmins(db, mailer, settings, 'responsible', (admins) =>
        newResponsibleRequestMail(admins, reviewUrl),
      )
      session.flash('notice', 'Demande envoyée : un administrateur va l’examiner.')
      return redirect(showUrl, 303)
    },

    // US-0.8.3: one open request per person and collectif; its responsibles decide, by e-mail.
    async join(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor

      const { db, mailer, settings, session } = context
      const collectif = await findActiveCollectifBySlug(db, context.params.slug)
      if (collectif === null) return notFound(context)
      if (!canRequestMembership(actor, collectif.id)) return forbidden(context)

      const showUrl = routes.collectifs.show.href({ slug: collectif.slug })
      const existing = await findMembership(db, actor.id, collectif.id)
      if (existing?.status === 'pending') {
        session.flash('notice', 'Vous avez déjà une demande en cours pour ce collectif.')
        return redirect(showUrl, 303)
      }

      const limit = await hitUserRequest(db, settings, actor.id)
      if (!limit.allowed) return tooManyRequests(context, limit.retryAfterSeconds)

      await db.transaction(async (tx) => {
        await requestMembership(tx, actor.id, collectif.id)
        await logAction(tx, {
          actorId: actor.id,
          action: 'member.requested',
          entity: 'collectif',
          entityId: collectif.id,
          payload: { userId: actor.id },
        })
      })
      const membersUrl = settings.appUrl + routes.collectifs.people.href({ slug: collectif.slug })
      // One e-mail per responsible: co-responsibles never see each other's address.
      for (const to of await listResponsibleEmails(db, collectif.id)) {
        await sendSafely(
          mailer,
          membershipRequestMail({
            to,
            personName: actor.name,
            collectifName: collectif.name,
            membersUrl,
          }),
        )
      }
      session.flash('notice', 'Demande envoyée : un responsable du collectif va l’examiner.')
      return redirect(showUrl, 303)
    },
  },
})
