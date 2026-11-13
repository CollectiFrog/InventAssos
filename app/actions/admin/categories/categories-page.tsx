import type { Handle } from 'remix/component'

import type { Category } from '../../../data/tables.ts'
import { routes } from '../../../routes.ts'
import { CsrfField, ErrorSummary, type FieldErrors, TextField } from '../../../ui/form.tsx'
import { Layout, type Viewer } from '../../../ui/layout.tsx'
import { AdminTabs } from '../admin-tabs.tsx'

/** Props of the categories page. */
export interface CategoriesPageProps {
  viewer: Viewer
  csrfToken: string
  categories: Category[]
  /** Items using each category, archived ones included. */
  usage: Map<string, number>
  values: Record<string, string>
  errors: FieldErrors
  notice?: string
}

/** "1 objet", "3 objets". */
function objects(n: number): string {
  return `${n} ${n > 1 ? 'objets' : 'objet'}`
}

/** Categories in their order, each renamed, moved or deleted in place; a form adds one. */
export function CategoriesPage(handle: Handle<CategoriesPageProps>) {
  return () => {
    const { viewer, csrfToken, categories, usage, values, errors, notice } = handle.props
    return (
      <Layout title="Catégories" viewer={viewer} headerLink="admin">
        <h1>Administration</h1>
        <AdminTabs current="categories" viewer={viewer} />
        {notice ? (
          <p class="notice notice-success" role="status">
            {notice}
          </p>
        ) : null}
        <ErrorSummary errors={errors} />
        <p class="status">
          La liste proposée dans le formulaire d’ajout et dans les filtres de recherche, dans cet
          ordre. Chaque catégorie garde sa clé, même renommée.
        </p>
        <ol class="category-list">
          {categories.map((category, index) => {
            const used = usage.get(category.id) ?? 0
            const nameField = `name-${category.id}`
            const moveField = `moveTo-${category.id}`
            const others = categories.filter((other) => other.id !== category.id)
            return (
              <li key={category.id} id={`categorie-${category.id}`} class="card category-row">
                <form
                  method="post"
                  action={routes.admin.categories.rename.href({ categoryId: category.id })}
                  class="inline-form"
                >
                  <CsrfField token={csrfToken} />
                  <label for={`field-${nameField}`} class="visually-hidden">
                    Nom de la catégorie {category.name}
                  </label>
                  <input
                    id={`field-${nameField}`}
                    name="name"
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
                <p class="status">
                  Clé : {category.id} · {objects(used)}
                </p>
                <div class="actions">
                  <form
                    method="post"
                    action={routes.admin.categories.up.href({ categoryId: category.id })}
                  >
                    <CsrfField token={csrfToken} />
                    <button
                      type="submit"
                      class="secondary"
                      disabled={index === 0}
                      aria-label={`Monter « ${category.name} »`}
                    >
                      Monter
                    </button>
                  </form>
                  <form
                    method="post"
                    action={routes.admin.categories.down.href({ categoryId: category.id })}
                  >
                    <CsrfField token={csrfToken} />
                    <button
                      type="submit"
                      class="secondary"
                      disabled={index === categories.length - 1}
                      aria-label={`Descendre « ${category.name} »`}
                    >
                      Descendre
                    </button>
                  </form>
                </div>
                <details class="confirm" open={Boolean(errors[moveField])}>
                  <summary>Supprimer…</summary>
                  <form
                    method="post"
                    action={routes.admin.categories.remove.href({ categoryId: category.id })}
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
                          aria-describedby={
                            errors[moveField] ? `field-${moveField}-error` : undefined
                          }
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
              </li>
            )
          })}
        </ol>
        <section aria-labelledby="ajouter-categorie">
          <h2 id="ajouter-categorie">Ajouter une catégorie</h2>
          <form method="post" action={routes.admin.categories.create.href()} class="stack">
            <CsrfField token={csrfToken} />
            <TextField
              name="name"
              label="Nom"
              value={values.name}
              error={errors.name}
              required
              maxLength={60}
              hint="En français, tel qu’il apparaîtra dans les listes. Elle s’ajoute en fin de liste."
            />
            <button type="submit">Ajouter</button>
          </form>
        </section>
      </Layout>
    )
  }
}
