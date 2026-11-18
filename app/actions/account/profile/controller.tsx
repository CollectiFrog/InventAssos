import * as f from 'remix/data-schema/form-data'
import { getCsrfToken } from 'remix/middleware/csrf'
import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { findUserById, updateProfile } from '../../../data/users.ts'
import { canEditOwnProfile } from '../../../permissions.ts'
import { routes } from '../../../routes.ts'
import { formValue, optionalPhone, parseForm, requiredText } from '../../../validation.ts'
import { forbidden, requireUser } from '../../guards.tsx'
import { viewerOf } from '../../viewer.ts'
import { type EditableRow, editableRows, ProfilePage } from './profile-page.tsx'

/** The row `?modifier=` asks to edit, if it names one (ADR 0034). */
function editingFrom(url: URL): EditableRow | undefined {
  const asked = url.searchParams.get('modifier')
  return editableRows.find((row) => row === asked)
}

const profileSchema = f.object({
  name: f.field(requiredText(120)),
  phone: f.field(optionalPhone()),
})

export default createController(routes.account.profile, {
  actions: {
    async index(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canEditOwnProfile(actor)) return forbidden(context)

      const user = await findUserById(context.db, actor.id)
      if (user === null) return forbidden(context)
      return context.render(
        <ProfilePage
          viewer={viewerOf(context)}
          csrfToken={getCsrfToken(context)}
          email={user.email}
          values={{ name: user.name, phone: user.phone ?? '' }}
          collectifs={actor.collectifs}
          hasPassword={user.password_hash !== null}
          editing={editingFrom(context.url)}
          saved={context.session.get('profileSaved') === true}
        />,
      )
    },

    async action(context) {
      const actor = requireUser(context)
      if (actor instanceof Response) return actor
      if (!canEditOwnProfile(actor)) return forbidden(context)

      const user = await findUserById(context.db, actor.id)
      if (user === null) return forbidden(context)
      // Mon compte edits one field at a time (ADR 0034): a field the form leaves out keeps its value.
      const sent = context.formData
      const values = {
        name: sent.has('name') ? formValue(sent, 'name') : user.name,
        phone: sent.has('phone') ? formValue(sent, 'phone') : (user.phone ?? ''),
      }
      const form = new FormData()
      form.set('name', values.name)
      form.set('phone', values.phone)
      const parsed = parseForm(profileSchema, form)
      if (!parsed.ok) {
        return context.render(
          <ProfilePage
            viewer={viewerOf(context)}
            csrfToken={getCsrfToken(context)}
            email={user.email}
            values={values}
            collectifs={actor.collectifs}
            hasPassword={user.password_hash !== null}
            editing={parsed.errors.phone ? 'telephone' : 'nom'}
            errors={parsed.errors}
          />,
          { status: 400 },
        )
      }

      // Always the signed-in person's own account: no user ID comes from the form.
      await updateProfile(context.db, actor.id, parsed.value)
      context.session.flash('profileSaved', true)
      return redirect(routes.account.profile.index.href(), 303)
    },
  },
})
