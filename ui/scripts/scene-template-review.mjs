import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { parsePort, startReviewServer, validateListenHost, LOOPBACK_HOST } from './sceneTemplateReview/server.mjs'
import { buildReviewUi } from './sceneTemplateReview/build.mjs'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const uiRoot = path.resolve(scriptDir, '..')
const repoRoot = path.resolve(uiRoot, '..')

function usage() {
  return `Usage: tsx scripts/scene-template-review.mjs [--render] [--host 192.168.x.x] [--port N] [template-id ...]

Builds the actual UI into a temporary directory and serves a provider-free review sandbox.
The default bind is loopback on an ephemeral port; --host may expose the same server on
one RFC1918 address present on a local interface. Every run writes only to a fresh
directory under the operating system temporary directory.
`
}

function parseArgs(argv) {
  let render = false
  let host = LOOPBACK_HOST
  let port = 0
  const templateIds = []
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--help' || argument === '-h') return { help: true }
    if (argument === '--render') { render = true; continue }
    if (argument === '--host' || argument === '--port') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) throw new Error(`${argument} needs a value.`)
      index += 1
      if (argument === '--host') host = value
      else port = parsePort(value)
      continue
    }
    if (argument.startsWith('--host=')) { host = argument.slice('--host='.length); continue }
    if (argument.startsWith('--port=')) { port = parsePort(argument.slice('--port='.length)); continue }
    if (argument.startsWith('--')) throw new Error(`Unknown option “${argument}”.`)
    templateIds.push(argument)
  }
  if (templateIds.length && !render) throw new Error('Template IDs require --render.')
  validateListenHost(host)
  return { render, host, port, templateIds }
}

async function holdServer(server) {
  let stopped = false
  let resolveStop
  const stoppedPromise = new Promise(resolve => { resolveStop = resolve })
  const shutdown = async signal => {
    if (stopped) return
    stopped = true
    console.log(`Stopping review sandbox (${signal}).`)
    await server.close()
    resolveStop()
  }
  const onInterrupt = () => { void shutdown('interrupt') }
  const onTerminate = () => { void shutdown('terminate') }
  process.once('SIGINT', onInterrupt)
  process.once('SIGTERM', onTerminate)
  await stoppedPromise
  process.off('SIGINT', onInterrupt)
  process.off('SIGTERM', onTerminate)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) { console.log(usage()); return }
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hocus-scene-template-review-'))
  const uiDist = await buildReviewUi({ uiRoot, outputDir })
  const server = await startReviewServer({ uiDist, outputDir, host: options.host, port: options.port })
  console.log(`REVIEW_OUTPUT_DIR=${outputDir}`)
  console.log(`REVIEW_URL_LOCAL=${server.localOrigin}/scene-template-review`)
  if (server.lanOrigin) console.log(`REVIEW_URL_LAN=${server.lanOrigin}/scene-template-review`)
  console.log('REVIEW_PROVIDERS=blocked')
  console.log('REVIEW_PERSISTENCE=in-memory index; fresh temporary directory; no restart recovery')

  if (options.render) {
    try {
      const { renderTemplates } = await import('./sceneTemplateReview/render.mjs')
      const result = await renderTemplates({ server, repoRoot, templateIds: options.templateIds })
      console.log(`REVIEW_RENDERED=${result.results.length}`)
      if (result.failures.length) {
        process.exitCode = 1
        console.error(`REVIEW_RENDER_FAILED=${result.failures.length}; no placeholder previews were created.`)
      } else {
        console.log('REVIEW_RENDER_STATUS=rendered-not-approved')
      }
    } catch (error) {
      process.exitCode = 1
      console.error(`REVIEW_RENDER_ERROR=${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log('REVIEW_SERVER=running; press Ctrl-C to stop.')
  await holdServer(server)
}

try {
  await main()
} catch (error) {
  process.exitCode = 1
  console.error(`SCENE_TEMPLATE_REVIEW_ERROR=${error instanceof Error ? error.message : String(error)}`)
  console.error(usage())
}
