import type { Handle, RemixNode } from 'remix/component'

import type { ItemDetails } from '../../data/items.ts'
import { routes } from '../../routes.ts'
import { archiveReasonLabels, conditionLabels, formatEuros } from '../../ui/labels.ts'
import { Layout, type Viewer } from '../../ui/layout.tsx'

const dateFormat = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'Europe/Paris' })

/** Props of an item's page. */
export interface ItemPageProps {
  viewer: Viewer
  item: ItemDetails
  /** Whether the viewer may edit, move and archive the item (`canEditItem`). */
  canEdit?: boolean
  /** Contact section (US-0.6.3); absent on the viewer's own items. */
  contact?: { csrfToken: string; sent?: boolean; error?: string }
  /** History section (US-0.5.6). */
  history?: RemixNode
  notice?: string
}

/** An item: what it is, where it is stored (city), who owns it. */
export function ItemPage(handle: Handle<ItemPageProps>) {
  return () => {
    const { viewer, item, canEdit, contact, history, notice } = handle.props
    return (
      <Layout title={item.name} viewer={viewer}>
        <h1>
          {item.name}
          {item.quantity > 1 ? ` × ${item.quantity}` : null}
        </h1>
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
          <dt>Rangé à</dt>
          <dd>
            <a href={routes.locations.show.href({ locationId: item.location_id })}>
              {item.locationName}
            </a>{' '}
            · {item.city}
          </dd>
          <dt>Appartient à</dt>
          <dd>
            {item.ownerSlug ? (
              <a href={routes.collectifs.show.href({ slug: item.ownerSlug })}>{item.ownerName}</a>
            ) : (
              item.ownerName
            )}
          </dd>
        </dl>
        {item.description ? <p class="prose">{item.description}</p> : null}
        {contact && !item.archived_at ? (
          <section class="contact">
            <h2>Contacter {item.ownerName}</h2>
            {item.contactPhone ? (
              <p>
                Téléphone :{' '}
                <a href={`tel:${item.contactPhone.replace(/[^0-9+]/g, '')}`}>{item.contactPhone}</a>
              </p>
            ) : (
              <>
                <p>Pas de téléphone renseigné. Écrivez-lui via la plateforme :</p>
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
                    />
                    {contact.error ? <p class="error">{contact.error}</p> : null}
                  </div>
                  <p class="hint">
                    Son adresse reste cachée ; la vôtre lui est transmise pour qu’il puisse vous
                    répondre.
                  </p>
                  <button type="submit">Envoyer</button>
                </form>
              </>
            )}
          </section>
        ) : null}
        {canEdit && !item.archived_at ? (
          <p class="actions">
            <a class="button secondary" href={routes.items.edit.index.href({ itemId: item.id })}>
              Modifier
            </a>
            <a class="button secondary" href={routes.items.move.index.href({ itemId: item.id })}>
              Déplacer
            </a>
            <a class="button secondary" href={routes.items.archive.index.href({ itemId: item.id })}>
              Archiver
            </a>
          </p>
        ) : null}
        {history}
      </Layout>
    )
  }
}
