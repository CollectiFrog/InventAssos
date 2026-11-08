// Application configuration, read once from environment variables (see .env.example).

/** Settings the app needs at runtime; nothing here has a default for production secrets. */
export interface Config {
  databaseUrl: string
  port: number
}

/** Reads and validates the configuration; throws with every missing or invalid variable listed. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const errors: string[] = []

  const databaseUrl = env.DATABASE_URL ?? ''
  if (databaseUrl === '') errors.push('DATABASE_URL is required')

  const port = Number(env.PORT ?? '3000')
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be a TCP port')

  if (errors.length > 0) throw new Error(`Invalid configuration: ${errors.join('; ')}`)

  return { databaseUrl, port }
}
