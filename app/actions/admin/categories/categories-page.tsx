import type { Handle } from 'remix/component'

import type { Category } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors } from '../../../ui/form.tsx'
import { IconButton } from '../../../ui/icons.tsx'
import { type ItemView, ViewSwitch } from '../../../ui/item-table.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { AdminTabs } from '../admin-tabs.tsx'

/** Props of the categories page. */
export interface CategoriesPageProps {
  viewer: Viewer
  csrfToken: string
  categories: Category[]
  /** Items using each category, archived ones included. */
  usage: Map<string, number>
  /** A dense table by default, compact cards with `?vue=grille`; kept across every change. */
  view: ItemView
  values: Record<string, string>
  errors: FieldErrors
  notice?: string
}

/** "1 objet", "3 objets". */
function objects(n: number): string {
  return `${n} ${n > 1 ? 'objets' : 'objet'}`
}

/** `?vue=grille` for the grid, nothing for the table: forms post there to come back the same. */
export function viewQuery(view: ItemView): string {
  return view === 'grille' ? '?vue=grille' : ''
}

/** What one category's controls need. */
interface CategoryProps {
  category: Category
  index: number
  categories: Category[]
  used: number
  csrfToken: string
  view: ItemView
  values: Record<string, string>
  errors: FieldErrors
}

/** The name as a field, submitted by « Renommer »; its error under it. */
function RenameForm(handle: Handle<CategoryProps>) {
  return () => {
    const { category, csrfToken, view, values, errors } = handle.props
    const nameField = `name-${category.id}`
    return (
      <>
        <form
          method="post"
          action={`${routes.admin.categories.rename.href({ categoryId: category.id })}${viewQuery(view)}`}
          class="inline-form"
        >
          <CsrfField token={csrfToken} />
          <label for={`field-${nameField}`} class="visually-hidden">
            Nom de la catégorie {category.name}
          </label>
          <input
            id={`field-${nameField}`}
            name="name"
            autoComplete="off"
            value={values[nameField] ?? category.name}
            maxLength={60}
            required
            aria-invalid={errors[nameField] ? 'true' : undefined}
            aria-describedby={errors[nameField] ? `field-${nameField}-error` : undefined}
          />
          <button type="submit" class="secondary">
            Renommer
          </button>
        </form>
        {errors[nameField] ? (
          <p class="error" id={`field-${nameField}-error`}>
            {errors[nameField]}
          </p>
        ) : null}
      </>
    )
  }
}

/** Up and down one place, as icons (ADR 0031); the first cannot go up nor the last down. */
function MoveButtons(handle: Handle<CategoryProps>) {
  return () => {
    const { category, index, categories, csrfToken, view } = handle.props
    const q = viewQuery(view)
    return (
      <div class="icon-toolbar">
        <form
          method="post"
          action={`${routes.admin.categories.up.href({ categoryId: category.id })}${q}`}
        >
          <CsrfField token={csrfToken} />
          <IconButton icon="up" label={`Monter « ${category.name} »`} disabled={index === 0} />
        </form>
        <form
          method="post"
          action={`${routes.admin.categories.down.href({ categoryId: category.id })}${q}`}
        >
          <CsrfField token={csrfToken} />
          <IconButton
            icon="down"
            label={`Descendre « ${category.name} »`}
            disabled={index === categories.length - 1}
          />
        </form>
      </div>
    )
  }
}

/** « Supprimer… »: asks where its items go first, when some use it. */
function DeleteForm(handle: Handle<CategoryProps>) {
  return () => {
    const { category, categories, used, csrfToken, view, errors } = handle.props
    const moveField = `moveTo-${category.id}`
    const others = categories.filter((other) => other.id !== category.id)
    return (
      <details class="confirm" open={Boolean(errors[moveField])}>
        <summary>Supprimer…</summary>
        <form
          method="post"
          action={`${routes.admin.categories.remove.href({ categoryId: category.id })}${viewQuery(view)}`}
          class="stack"
        >
          <CsrfField token={csrfToken} />
          {used > 0 ? (
            <div class={errors[moveField] ? 'field field-invalid' : 'field'}>
              <label for={`field-${moveField}`}>Déplacer ses {objects(used)} vers</label>
              <select
                id={`field-${moveField}`}
                name="moveTo"
                required
                aria-invalid={errors[moveField] ? 'true' : undefined}
                aria-describedby={errors[moveField] ? `field-${moveField}-error` : undefined}
              >
                <option value="">Choisir…</option>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.name}
                  </option>
                ))}
              </select>
              {errors[moveField] ? (
                <p class="error" id={`field-${moveField}-error`}>
                  {errors[moveField]}
                </p>
              ) : null}
            </div>
          ) : (
            <p>Aucun objet n’utilise cette catégorie.</p>
          )}
          <button type="submit" class="danger">
            Supprimer « {category.name} »
          </button>
        </form>
      </details>
    )
  }
}

/**
 * Categories in their order, as a table with one column per property or as compact cards several
 * to a row; each is renamed, moved or deleted in place, and a form adds one.
 */
export function CategoriesPage(handle: Handle<CategoriesPageProps>) {
  return () => {
    const { viewer, csrfToken, categories, usage, view, values, errors, notice } = handle.props
    const listUrl = routes.admin.categories.index.href()
    const propsOf = (category: Category, index: number): CategoryProps => ({
      category,
      index,
      categories,
      used: usage.get(category.id) ?? 0,
      csrfToken,
      view,
      values,
      errors,
    })
    return (
      <Layout title="Catégories" viewer={viewer} section="admin">
        <h1 class="visually-hidden">Administration</h1>
        <AdminTabs current="categories" viewer={viewer} />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <section aria-labelledby="categories-titre" class="index-results">
          <div class="results-bar">
            <h2 id="categories-titre">Catégories · {categories.length}</h2>
            <ViewSwitch view={view} hrefFor={(next) => `${listUrl}${viewQuery(next)}`} />
          </div>
          <p class="status">
            La liste proposée dans le formulaire d’ajout et dans les filtres de recherche, dans cet
            ordre. Chaque catégorie garde sa clé, même renommée.
          </p>
          {view === 'grille' ? (
            <ol class="cards category-grid">
              {categories.map((category, index) => {
                const props = propsOf(category, index)
                return (
                  <li key={category.id} id={`categorie-${category.id}`} class="card category-card">
                    <RenameForm {...props} />
                    <p class="status">
                      {index + 1}. Clé : <code>{category.id}</code> · {objects(props.used)}
                    </p>
                    <div class="category-card-actions">
                      <MoveButtons {...props} />
                      <DeleteForm {...props} />
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <table class="data-table category-table">
              <caption class="visually-hidden">Catégories, dans l’ordre des listes</caption>
              <thead>
                <tr>
                  <th scope="col" class="num">
                    Ordre
                  </th>
                  <th scope="col">Nom</th>
                  <th scope="col">Clé</th>
                  <th scope="col" class="num">
                    Objets
                  </th>
                  <th scope="col">
                    <span class="visually-hidden">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category, index) => {
                  const props = propsOf(category, index)
                  return (
                    <tr key={category.id} id={`categorie-${category.id}`}>
                      <td data-label="Ordre" class="num">
                        {index + 1}
                      </td>
                      <td data-label="Nom" class="cell-name">
                        <RenameForm {...props} />
                      </td>
                      <td data-label="Clé">
                        <code>{category.id}</code>
                      </td>
                      <td data-label="Objets" class="num">
                        {props.used}
                      </td>
                      <td class="cell-actions">
                        <div class="category-row-actions">
                          <MoveButtons {...props} />
                          <DeleteForm {...props} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </section>
        {/* One field and a « + »: the placeholder says what it adds, the label stays for readers. */}
        <form
          method="post"
          action={`${routes.admin.categories.create.href()}${viewQuery(view)}`}
          class="inline-form category-add"
        >
          <CsrfField token={csrfToken} />
          <label for="field-name" class="visually-hidden">
            Nouvelle catégorie
          </label>
          <input
            id="field-name"
            name="name"
            autoComplete="off"
            value={values.name}
            placeholder="Nouvelle catégorie"
            maxLength={60}
            required
            aria-invalid={errors.name ? 'true' : undefined}
            aria-describedby={errors.name ? 'field-name-error' : undefined}
          />
          <IconButton icon="add" label="Ajouter la catégorie" primary />
        </form>
        {errors.name ? (
          <p class="error" id="field-name-error">
            {errors.name}
          </p>
        ) : null}
      </Layout>
    )
  }
}
