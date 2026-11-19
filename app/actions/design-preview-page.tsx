import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import type { Theme } from '../theme.ts'
import { SelectField, TextArea, TextField } from '../ui/form.tsx'
import { Icon, IconLink } from '../ui/icons.tsx'
import { ActiveFilters, ViewSwitch } from '../ui/item-table.tsx'
import { Layout, ThemeSwitch, type Viewer } from '../ui/layout.tsx'
import { StatusBadge } from '../ui/status-badge.tsx'
import { Tabs } from '../ui/tabs.tsx'

/** Colour tokens shown as swatches, by group. */
const colourGroups: { title: string; tokens: string[] }[] = [
  {
    title: 'Surfaces',
    tokens: ['bg-canvas', 'bg-panel', 'bg-surface', 'bg-raised', 'bg-hover', 'bg-selected'],
  },
  { title: 'Bordures', tokens: ['border-subtle', 'border', 'border-strong', 'border-control'] },
  { title: 'Texte', tokens: ['text-primary', 'text-secondary', 'text-tertiary'] },
  {
    title: 'Accent et danger',
    tokens: ['accent', 'accent-hover', 'accent-text', 'accent-subtle', 'focus-ring', 'danger'],
  },
  {
    title: 'États du matériel',
    tokens: [
      'status-available',
      'status-lent',
      'status-broken',
      'status-reserved',
      'status-archived',
    ],
  },
  {
    title: 'Lieux de la scène d’accueil',
    tokens: ['place-1', 'place-2', 'place-3', 'place-4', 'place-0'],
  },
]

const typeScale: { token: string; sample: string }[] = [
  { token: 'text-3xl', sample: 'Connexion à AssoMatos' },
  { token: 'text-2xl', sample: 'Console Yamaha MG10XU' },
  { token: 'text-xl', sample: 'Rechercher' },
  { token: 'text-lg', sample: 'Où le trouver' },
  { token: 'text-md', sample: 'Formulaires et texte courant : 14 px.' },
  { token: 'text-sm', sample: 'Interface par défaut, tableaux, navigation : 13 px.' },
  { token: 'text-xs', sample: 'Méta, badges, en-têtes de colonnes : 12 px.' },
]

/** Fictional rows for the table sample. */
const sampleRows = [
  {
    name: 'Projecteur PAR LED 18×10 W',
    category: 'Lumière',
    owner: 'Collecti’FROG',
    city: 'Rennes',
    qty: 12,
    status: null,
  },
  {
    name: 'Console Yamaha MG10XU',
    category: 'Son',
    owner: 'Camille Martin',
    city: 'Vitré',
    qty: 1,
    status: 'broken' as const,
  },
  {
    name: 'Praticable 2 × 1 m',
    category: 'Scène',
    owner: 'Les Tréteaux',
    city: 'Fougères',
    qty: 8,
    status: null,
  },
  {
    name: 'Rallonge 25 m',
    category: 'Électricité',
    owner: 'Collecti’FROG',
    city: 'Rennes',
    qty: 6,
    status: 'archived' as const,
  },
]

/** One swatch per token, painted by a class of the same name (no inline style: CSP). */
function Swatches(handle: Handle<{ tokens: string[] }>) {
  return () => (
    <ul class="swatches">
      {handle.props.tokens.map((token) => (
        <li class="swatch">
          <span class={`swatch-chip swatch-${token}`} />
          <code>--{token}</code>
        </li>
      ))}
    </ul>
  )
}

/**
 * /dev/ui (ADR 0032): every token and shared component, to review the design system in both
 * themes. Fictional data only; `?theme=` previews a theme without changing the cookie.
 */
export function DesignPreviewPage(handle: Handle<{ viewer: Viewer; theme?: Theme }>) {
  return () => {
    const { viewer, theme } = handle.props
    const here = routes.designPreview.href()
    return (
      <Layout
        title="Système de design"
        viewer={viewer}
        theme={theme}
        trail={[{ label: 'Système de design' }]}
      >
        <div class="page-head">
          <div>
            <h1>Système de design</h1>
            <p class="status">
              Jetons et composants partagés, dans le thème courant. Hors production seulement.
            </p>
          </div>
          <nav aria-label="Thème de l’aperçu" class="view-switch">
            <a href={here} aria-current={theme === undefined ? 'page' : undefined}>
              <Icon name="system" />
              Courant
            </a>
            <a href={`${here}?theme=light`} aria-current={theme === 'light' ? 'page' : undefined}>
              <Icon name="light" />
              Clair
            </a>
            <a href={`${here}?theme=dark`} aria-current={theme === 'dark' ? 'page' : undefined}>
              <Icon name="dark" />
              Sombre
            </a>
          </nav>
        </div>

        <h2>Couleurs</h2>
        {colourGroups.map((group) => (
          <>
            <h3>{group.title}</h3>
            <Swatches tokens={group.tokens} />
          </>
        ))}
        <h3>Élévation</h3>
        <div class="surfaces">
          <div class="surface-canvas">canvas</div>
          <div class="surface-panel">panel</div>
          <div class="surface-surface">surface · élévation 1</div>
          <div class="surface-raised">raised · élévation 2</div>
        </div>

        <h2>Typographie</h2>
        <div class="type-scale">
          {typeScale.map((row) => (
            <p class={`type-${row.token}`}>
              <code>--{row.token}</code> {row.sample}
            </p>
          ))}
          <p>
            <code>tabular-nums</code> <span class="num">1 234,50 € · 12 · 08/11/2026</span>
          </p>
        </div>

        <h2>Boutons</h2>
        <div class="preview-row">
          <span class="status">Défaut</span>
          <button type="button">Enregistrer</button>
          <button type="button" class="secondary">
            Annuler
          </button>
          <button type="button" class="ghost">
            Plus tard
          </button>
          <button type="button" class="danger">
            Supprimer
          </button>
        </div>
        <div class="preview-row">
          <span class="status">Désactivé</span>
          <button type="button" disabled>
            Enregistrer
          </button>
          <button type="button" class="secondary" disabled>
            Annuler
          </button>
        </div>
        <div class="preview-row">
          <span class="status">Tailles</span>
          <button type="button" class="small">
            Petit
          </button>
          <button type="button">Moyen</button>
          <button type="button" class="large">
            Grand
          </button>
          <button type="button" class="secondary">
            <Icon name="download" />
            Avec icône
          </button>
        </div>
        <div class="preview-row icon-toolbar">
          <span class="status">Icônes</span>
          <IconLink icon="edit" label="Modifier" href={here} />
          <IconLink icon="move" label="Déplacer" href={here} />
          <IconLink icon="archive" label="Archiver" href={here} />
          <IconLink icon="upload" label="Importer" href={here} />
          <IconLink icon="download" label="Exporter" href={here} />
          <IconLink icon="add" label="Ajouter un lieu" text="Lieu" href={here} />
          <IconLink icon="remove" label="Supprimer" danger href={here} />
          <IconLink icon="add" label="Ajouter du matériel" primary href={here} />
        </div>
        <p class="status">Survol, appui et focus clavier : passez la souris ou tabulez.</p>

        <h2>Champs</h2>
        <form class="stack" method="get" action={here} aria-label="Exemple de formulaire">
          <TextField name="nom" label="Nom" value="Projecteur PAR LED" required />
          <TextField
            name="marque"
            label="Marque"
            hint="Celle écrite sur l’appareil, si elle est lisible."
          />
          <TextField name="quantite" label="Quantité" value="0" error="Au moins 1." required />
          <SelectField
            name="categorie"
            label="Catégorie"
            options={[
              { value: 'lumiere', label: 'Lumière' },
              { value: 'son', label: 'Son' },
            ]}
            emptyLabel="Choisir…"
          />
          <TextArea name="description" label="Description" />
          <label class="check">
            <input type="checkbox" name="casse" checked />
            Case à cocher
          </label>
          <label class="check">
            <input
              type="checkbox"
              class="switch"
              name="interrupteur"
              role="switch"
              aria-checked="true"
              checked
            />
            Interrupteur
          </label>
          <div class="field">
            <label for="apercu-desactive">Désactivé</label>
            <input id="apercu-desactive" name="desactive" value="Rennes" disabled />
          </div>
        </form>

        <h2>Badges</h2>
        <div class="preview-row">
          <StatusBadge status="available" />
          <StatusBadge status="lent" />
          <StatusBadge status="broken" />
          <StatusBadge status="reserved" />
          <StatusBadge status="archived" />
          <span class="badge">Responsable</span>
          <span class="thumb" aria-hidden="true">
            <Icon name="equipment" />
          </span>
          <kbd>/</kbd>
          <kbd>⌘K</kbd>
        </div>

        <h2>Liste</h2>
        <div class="index-results">
          <div class="results-bar">
            <p>4 objets</p>
            <ActiveFilters
              filters={[
                { label: 'Catégorie : Lumière', removeHref: here },
                { label: 'Ville : Rennes', removeHref: here },
              ]}
              clearHref={here}
            />
            <ViewSwitch view="liste" hrefFor={() => here} />
          </div>
          <table class="data-table">
            <caption class="visually-hidden">Exemple de liste de matériel</caption>
            <thead>
              <tr>
                <th scope="col" aria-sort="ascending">
                  <a href={here}>
                    Nom<span aria-hidden="true"> ↑</span>
                  </a>
                </th>
                <th scope="col">Catégorie</th>
                <th scope="col">Propriétaire</th>
                <th scope="col">Ville</th>
                <th scope="col">Statut</th>
                <th scope="col" class="num">
                  Qté
                </th>
              </tr>
            </thead>
            <tbody>
              {sampleRows.map((row) => (
                <tr>
                  <td data-label="Nom" class="cell-name">
                    <a href={here}>{row.name}</a>
                  </td>
                  <td data-label="Catégorie">{row.category}</td>
                  <td data-label="Propriétaire">{row.owner}</td>
                  <td data-label="Ville">{row.city}</td>
                  <td data-label="Statut">
                    {row.status ? <StatusBadge status={row.status} /> : null}
                  </td>
                  <td data-label="Quantité" class="num">
                    {row.qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Navigation</h2>
        <Tabs
          label="Exemple d’onglets"
          tabs={[
            { label: 'Matériel', href: here, current: true },
            { label: 'Lieux', href: here, current: false },
            { label: 'Membres (3)', href: here, current: false },
          ]}
        />
        {viewer ? (
          <div class="preview-row">
            <span class="status">Thème</span>
            <ThemeSwitch csrfToken={viewer.csrfToken} theme={viewer.theme} />
          </div>
        ) : null}

        <h2>Menu et panneau</h2>
        <div class="preview-row">
          <details class="menu">
            <summary class="button secondary">
              <Icon name="filter" />
              Filtre
            </summary>
            <div class="preview-panel">
              <a href={here}>Catégorie</a>
              <a href={here}>Collectif propriétaire</a>
              <a href={here}>Ville</a>
            </div>
          </details>
          <span title="Une info-bulle native : title, sans JavaScript." class="hint-mark">
            <Icon name="info" />
          </span>
        </div>
        <div class="detail">
          <div class="detail-main">
            <p class="notice">Une information neutre.</p>
            <p class="notice notice-success" role="status">
              Matériel ajouté.
            </p>
            <p class="notice notice-error">Le fichier n’a pas pu être lu.</p>
            <div class="card empty-state">
              <p>Aucun matériel ne correspond à ces filtres.</p>
              <a class="button secondary" href={here}>
                Réinitialiser les filtres
              </a>
            </div>
          </div>
          <aside class="detail-side" aria-label="Exemple de panneau latéral">
            <h2>Où le trouver</h2>
            <dl class="facts">
              <dt>Appartient à</dt>
              <dd>Collecti’FROG</dd>
              <dt>Rangé à</dt>
              <dd>Local du Blosne · Rennes</dd>
              <dt>Quantité</dt>
              <dd>12</dd>
            </dl>
            <p class="actions contact-buttons">
              <a class="button" href={here}>
                <Icon name="phone" />
                Appeler
              </a>
              <a class="button secondary" href={here}>
                <Icon name="message" />
                SMS
              </a>
            </p>
          </aside>
        </div>
      </Layout>
    )
  }
}
