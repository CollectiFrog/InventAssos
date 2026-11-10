import { createContextKey, type Middleware } from 'remix/router'

import type { Config } from '../config.ts'
import type { Mailer } from '../mail/mailer.ts'
import type { RateLimits } from '../rate-limits.ts'

/** The part of the configuration actions may read; `rateLimits` defaults to production values. */
export type AppSettings = Pick<Config, 'appUrl' | 'adminEmails'> & { rateLimits?: RateLimits }

/** Context key for the mailer; actions read it as `context.mailer`. */
export const MailerKey = createContextKey<Mailer>()
/** Context key for the settings; actions read them as `context.settings`. */
export const SettingsKey = createContextKey<AppSettings>()

/** Puts the mailer on every request context. */
export function provideMailer(mailer: Mailer): Middleware<{
  key: typeof MailerKey
  value: Mailer
  property: 'mailer'
}> {
  return (context, next) => {
    context.set(MailerKey, mailer, { property: 'mailer' })
    return next()
  }
}

/** Puts the application settings on every request context. */
export function provideSettings(settings: AppSettings): Middleware<{
  key: typeof SettingsKey
  value: AppSettings
  property: 'settings'
}> {
  return (context, next) => {
    context.set(SettingsKey, settings, { property: 'settings' })
    return next()
  }
}
