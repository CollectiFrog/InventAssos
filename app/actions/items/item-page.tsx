import type { Handle, RemixNode } from 'remix/component'

import type { ItemDetails } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import { CsrfField } from '../../ui/form.tsx'
import { archiveReasonLabels, conditionLabels, formatEuros } from '../../ui/labels.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/** Props of an item's page. */
export interface ItemPageProps {
  viewer: Viewer
  item: ItemDetails
  /** Whether the viewer may edit, move and archive the item (`canEditItem`). */
  canEdit?: boolean
  /** Whether the viewer may archive it as abusive (`canModerateItem`, US-0.8.2). */
  canModerate?: boolean
  /** Whether the viewer may delete it for good (`canDeleteItem`, US-0.8.9). */
  canDelete?: boolean
  /** A member's request to delete it (US-0.8.10): the form, or that it is already asked. */
  deletion?: { csrfToken: string; requested: boolean }
  /** Contact section (US-0.6.3); absent on the viewer's own items. */
  contact?: { csrfToken: string; sent?: boolean; error?: string }
  /** History section (US-0.5.6). */
  history?: RemixNode
  /** « Retour » on phones (`backHref`). */
  back?: string
  notice?: string
}

/** Digits and "+" only, for tel: and sms: links. */
function dialable(phone: string): string {
  return phone.replace(/[^0-9+]/g, '')
}

/** Who owns the item, linked to their page when the viewer may open it. */
function OwnerLink(handle: Handle<{ item: ItemDetails }>) {
  return () => {
    const { item } = handle.props
    if (item.ownerSlug) {
      return <a href={routes.collectifs.show.href({ slug: item.ownerSlug })}>{item.ownerName}</a>
    }
    if (item.ownerUserId) {
      return <a href={routes.people.show.href({ userId: item.ownerUserId })}>{item.ownerName}</a>
    }
    return <>{item.ownerName}</>
  }
}

/**
 * An item (US-0.7.6, detail template): owner and city at the top with Appeler / SMS / Écrire,
 * then its description beside a side panel (where it is, writing to its owner, managing it).
 */
export function ItemPage(handle: Handle<ItemPageProps>) {
  return () => {
    const {
      viewer,
      item,
      canEdit,
      canModerate,
      canDelete,
      deletion,
      contact,
      history,
      notice,
      back,
    } = handle.props
    // An item has no section of its own: the trail follows its owning collectif, else Rechercher.
    const trail = item.ownerSlug
      ? [
          { label: 'Collectifs', href: routes.collectifs.index.href() },
          { label: item.ownerName, href: routes.collectifs.show.href({ slug: item.ownerSlug }) },
          { label: item.name },
        ]
      : [{ label: 'Rechercher', href: routes.inventory.index.href() }, { label: item.name }]
    const reachable = contact !== undefined && !item.archived_at
    const phone = reachable ? item.contactPhone : null
    return (
      <Layout title={item.name} viewer={viewer} trail={trail} back={back ?? trail.at(-2)?.href}>
        <div class="page-head item-head">
          <div>
            <h1>
              {item.name}
              {item.quantity > 1 ? ` × ${item.quantity}` : null}
            </h1>
            <p class="status">
              À <OwnerLink item={item} /> · rangé à {item.city}
            </p>
          </div>
          {reachable ? (
            <p class="actions contact-buttons">
              {phone ? (
                <>
                  <a class="button" href={`tel:${dialable(phone)}`}>
                    Appeler
                  </a>
                  <a class="button secondary" href={`sms:${dialable(phone)}`}>
                    SMS
                  </a>
                </>
              ) : null}
              <a class={phone ? 'button secondary' : 'button'} href="#ecrire">
                Écrire
              </a>
            </p>
          ) : null}
        </div>
        {item.archived_at && item.archive_reason ? (
          <p class="notice">
            Archivé le {dateFormat.format(new Date(String(item.archived_at)))} :{' '}
            {archiveReasonLabels[item.archive_reason].toLowerCase()}. Il n’apparaît plus dans
            l’inventaire.
          </p>
        ) : null}
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <div class="detail">
          <div class="detail-main">
            <dl class="facts">
              <dt>Catégorie</dt>
              <dd>{item.categoryName}</dd>
              {item.brand ? (
                <>
                  <dt>Marque</dt>
                  <dd>{item.brand}</dd>
                </>
              ) : null}
              {item.model ? (
                <>
                  <dt>Modèle</dt>
                  <dd>{item.model}</dd>
                </>
              ) : null}
              {item.serial_number ? (
                <>
                  <dt>Numéro de série</dt>
                  <dd>{item.serial_number}</dd>
                </>
              ) : null}
              {item.condition ? (
                <>
                  <dt>État</dt>
                  <dd>{conditionLabels[item.condition]}</dd>
                </>
              ) : null}
              {item.estimated_value !== null ? (
                <>
                  <dt>Valeur estimée</dt>
                  <dd>{formatEuros(item.estimated_value)}</dd>
                </>
              ) : null}
            </dl>
            {item.description ? <p class="prose">{item.description}</p> : null}
            {history}
          </div>
          <aside class="detail-side" aria-label="Où le trouver">
            <div class="card">
              <dl class="facts">
                <dt>Appartient à</dt>
                <dd>
                  <OwnerLink item={item} />
                </dd>
                <dt>Rangé à</dt>
                <dd>
                  <a href={routes.locations.show.href({ locationId: item.location_id })}>
                    {item.locationName}
                  </a>{' '}
                  · {item.city}
                </dd>
                {phone ? (
                  <>
                    <dt>Téléphone</dt>
                    <dd>
                      <a href={`tel:${dialable(phone)}`}>{phone}</a>
                    </dd>
                  </>
                ) : null}
              </dl>
            </div>
            {reachable && contact ? (
              <section id="ecrire" class="card contact" aria-labelledby="ecrire-titre">
                <h2 id="ecrire-titre">Écrire à {item.ownerName}</h2>
                {phone ? null : <p>Pas de téléphone renseigné : écrivez-lui via la plateforme.</p>}
                {contact.sent ? (
                  <p class="notice notice-success" role="status">
                    Message envoyé. La réponse arrivera dans votre boîte e-mail.
                  </p>
                ) : null}
                <form
                  method="post"
                  action={routes.items.contact.href({ itemId: item.id })}
                  class="stack"
                >
                  <input type="hidden" name="_csrf" value={contact.csrfToken} />
                  <div class={contact.error ? 'field field-invalid' : 'field'}>
                    <label for="field-message">Votre message</label>
                    <textarea
                      id="field-message"
                      name="message"
                      rows={4}
                      maxLength={2000}
                      required
                      aria-invalid={contact.error ? 'true' : undefined}
                      aria-describedby={contact.error ? 'field-message-error' : undefined}
                    />
                    {contact.error ? (
                      <p class="error" id="field-message-error">
                        {contact.error}
                      </p>
                    ) : null}
                  </div>
                  <p class="hint">
                    Son adresse reste cachée ; la vôtre lui est transmise pour qu’il puisse vous
                    répondre.
                  </p>
                  <button type="submit">Envoyer</button>
                </form>
              </section>
            ) : null}
            {canEdit && !item.archived_at ? (
              <div class="card">
                <p class="actions">
                  <a
                    class="button secondary"
                    href={routes.items.edit.index.href({ itemId: item.id })}
                  >
                    Modifier
                  </a>
                  <a
                    class="button secondary"
                    href={routes.items.move.index.href({ itemId: item.id })}
                  >
                    Déplacer
                  </a>
                  <a
                    class="button secondary"
                    href={routes.items.archive.index.href({ itemId: item.id })}
                  >
                    Archiver
                  </a>
                </p>
              </div>
            ) : null}
            {canModerate && !canEdit && !item.archived_at ? (
              <div class="card">
                <p class="actions">
                  <a
                    class="button secondary"
                    href={routes.items.archive.index.href({ itemId: item.id })}
                  >
                    Retirer (modération)
                  </a>
                </p>
              </div>
            ) : null}
            {canDelete || deletion ? (
              <div class="card">
                {canDelete ? (
                  <p class="actions">
                    <a
                      class="button danger"
                      href={routes.items.remove.index.href({ itemId: item.id })}
                    >
                      Supprimer…
                    </a>
                  </p>
                ) : deletion?.requested ? (
                  <p class="status">Suppression demandée aux responsables du collectif.</p>
                ) : deletion ? (
                  <form
                    method="post"
                    action={routes.items.requestDeletion.href({ itemId: item.id })}
                    class="stack"
                  >
                    <CsrfField token={deletion.csrfToken} />
                    <p class="status">
                      Saisi par erreur ? Les responsables du collectif peuvent le supprimer.
                    </p>
                    <button type="submit" class="secondary">
                      Demander la suppression
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      </Layout>
    )
  }
}
