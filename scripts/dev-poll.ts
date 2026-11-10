// `npm run dev` with polling instead of file events, for the app container (compose.yaml): change
// events from a Windows or macOS host folder never reach the container, modification times do.
import { type ChildProcess, spawn } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const watched = ['server.ts', 'app', 'db/migrations']
const serverArgs = ['--env-file-if-exists=.env', '--import', 'remix/node-tsx', 'server.ts']
const intervalMs = 1000

/** Latest modification time and file count under the watched paths: any edit, add or delete moves it. */
function snapshot(): string {
  let latest = 0
  let count = 0
  const visit = (path: string) => {
    const stat = statSync(path, { throwIfNoEntry: false })
    if (!stat) return
    count += 1
    latest = Math.max(latest, stat.mtimeMs)
    if (stat.isDirectory()) for (const name of readdirSync(path)) visit(join(path, name))
  }
  for (const path of watched) visit(path)
  return `${latest}:${count}`
}

let server: ChildProcess | null = null

function start() {
  server = spawn(process.execPath, serverArgs, { stdio: 'inherit' })
}

/** Stops the server and waits for its graceful shutdown (server.ts handles SIGTERM). */
function stop(): Promise<void> {
  const current = server
  server = null
  if (!current || current.exitCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    current.once('exit', () => resolve())
    current.kill('SIGTERM')
  })
}

let seen = snapshot()
let restarting = false
start()

setInterval(async () => {
  if (restarting) return
  const now = snapshot()
  if (now === seen) return
  seen = now
  restarting = true
  console.log('Change detected, restarting the server…')
  await stop()
  start()
  restarting = false
}, intervalMs)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    stop().then(() => process.exit(0))
  })
}
