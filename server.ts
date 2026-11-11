import * as http from 'node:http'

import { createRequestListener, type FetchHandler } from 'remix/node-fetch-server'

import { createBackgroundTasks } from './app/background.ts'
import { withClientAddress } from './app/client-address.ts'
import { loadConfig } from './app/config.ts'
import { migrateDatabase, openDatabase } from './app/db.ts'
import { createLogMailer, createSmtpMailer } from './app/mail/mailer.ts'
import { purgeExpiredData, startPeriodicPurge } from './app/maintenance.ts'
import { createAppRouter } from './app/router.ts'

const config = loadConfig()
const db = openDatabase(config.databaseUrl)

// Migrate before listening, so no request ever sees an old schema.
await migrateDatabase(db)
await purgeExpiredData(db)
const stopPurge = startPeriodicPurge(db)

const mailer = config.smtpUrl
  ? createSmtpMailer(config.smtpUrl, config.mailFrom)
  : createLogMailer()
if (!config.smtpUrl) console.log('SMTP_URL is not set: e-mails are written to this log.')

if (config.production && !config.trustProxy) {
  console.warn('TRUST_PROXY is not set: per-client rate limits see the ingress, not the visitor.')
}

const background = createBackgroundTasks()
const router = createAppRouter({
  db,
  mailer,
  settings: { appUrl: config.appUrl, adminEmails: config.adminEmails },
  sessionSecret: config.sessionSecret,
  background,
})
const handler: FetchHandler = (request, client) =>
  router.fetch(withClientAddress(request, client.address))
const server = http.createServer(createRequestListener(handler, { trustProxy: config.trustProxy }))

server.listen(config.port, () => {
  console.log(`InventAssos listening on http://localhost:${config.port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  const purgeStopped = stopPurge()
  server.close(() => {
    // E-mails still being sent after their response, and a running purge, finish before the database closes.
    Promise.all([background.idle(), purgeStopped])
      .then(() => db.close())
      .catch((error: unknown) => console.error('Error while closing the database', error))
      .finally(() => process.exit(0))
  })
  server.closeIdleConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
