// Application configuration, read once from environment variables (see .env.example).
import { appName } from './brand.ts'

/** Settings the app needs at runtime. Production never falls back to a default secret. */
export interface Config {
  production: boolean
  databaseUrl: string
  port: number
  /** Public origin, used in e-mail links and to check the Origin of form posts. */
  appUrl: string
  sessionSecret: string
  /** Lower-cased e-mails that are platform admins (US-0.2.5); a change needs a restart. */
  adminEmails: ReadonlySet<string>
  /** SMTP connection URL; without it outside production, e-mails are written to the log. */
  smtpUrl: string | null
  mailFrom: string
  /** Take the client address from X-Forwarded-For / Forwarded: only behind a proxy that sets it. */
  trustProxy: boolean
}

/** Reads and validates the configuration; throws with every missing or invalid variable listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const errors: string[] = []
  const production = env.NODE_ENV === 'production'

  const databaseUrl = env.DATABASE_URL ?? ''
  if (databaseUrl === '') errors.push('DATABASE_URL is required')

  const port = Number(env.PORT ?? '3000')
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be a TCP port')

  const appUrl = (env.APP_URL ?? (production ? '' : `http://localhost:${port}`)).replace(/\/$/, '')
  if (!URL.canParse(appUrl)) errors.push('APP_URL must be an absolute URL (https://…)')

  const sessionSecret = env.SESSION_SECRET ?? ''
  if (sessionSecret.length < 32) errors.push('SESSION_SECRET must be at least 32 characters')
  // The .env.example placeholder is long enough: refuse it, or any copy of it, in production.
  if (production && /change-?me/i.test(sessionSecret)) {
    errors.push('SESSION_SECRET is the example value: generate one (openssl rand -base64 48)')
  }

  const smtpUrl = env.SMTP_URL?.trim() || null
  if (production && smtpUrl === null) errors.push('SMTP_URL is required in production')

  const mailFrom = env.MAIL_FROM?.trim() || `${appName} <noreply@collecti-frog.fr>`

  const trustProxy = (env.TRUST_PROXY ?? '').trim().toLowerCase()
  if (!['', 'true', 'false'].includes(trustProxy)) errors.push('TRUST_PROXY must be true or false')

  if (errors.length > 0) throw new Error(`Invalid configuration: ${errors.join('; ')}`)

  return {
    production,
    databaseUrl,
    port,
    appUrl,
    sessionSecret,
    adminEmails: parseEmailList(env.PLATFORM_ADMIN_EMAILS),
    smtpUrl,
    mailFrom,
    trustProxy: trustProxy === 'true',
  }
}

/** Parses a comma-separated list of e-mails, ignoring blanks and case. */
export function parseEmailList(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email !== ''),
  )
}
