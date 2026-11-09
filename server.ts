import * as http from 'node:http'

import { createRequestListener } from 'remix/node-fetch-server'

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

const router = createAppRouter({
  db,
  mailer,
  settings: { appUrl: config.appUrl, adminEmails: config.adminEmails },
  sessionSecret: config.sessionSecret,
})
const server = http.createServer(createRequestListener(router.fetch))

server.listen(config.port, () => {
  console.log(`InventAssos listening on http://localhost:${config.port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  stopPurge()
  server.close(() => {
    db.close()
      .catch((error: unknown) => console.error('Error while closing the database', error))
      .finally(() => process.exit(0))
  })
  server.closeIdleConnections()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
