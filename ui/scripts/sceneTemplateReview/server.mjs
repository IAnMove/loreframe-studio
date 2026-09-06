import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { randomUUID } from 'node:crypto'

const MAX_REQUEST_BYTES = 40 * 1024 * 1024
const MAX_BLOCKED_REQUESTS = 128
const LOOPBACK_HOST = '127.0.0.1'
const PREVIEW_PATH = /^\/scene-template-previews\/([a-z0-9][a-z0-9-]*(?:\.failure-[0-9a-f-]+)?)\.(mp4|png|json)$/
class RequestTooLargeError extends Error {}

const json = (response, value, status = 200) => {
  const bytes = Buffer.from(JSON.stringify(value))
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': bytes.length,
    'cache-control': 'no-store',
  })
  response.end(bytes)
}

const isPrivateIpv4 = value => {
  const octets = value.split('.').map(Number)
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) return false
  return octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
}

const localIpv4Addresses = () => new Set(Object.values(os.networkInterfaces())
  .flatMap(entries => entries || [])
  .filter(entry => entry.family === 'IPv4' || entry.family === 4)
  .map(entry => entry.address))

export function validateListenHost(host) {
  if (host === LOOPBACK_HOST) return host
  if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host) || !isPrivateIpv4(host)) {
    throw new Error(`--host must be 127.0.0.1 or a local RFC1918 IPv4 address; refused “${host}”.`)
  }
  if (!localIpv4Addresses().has(host)) {
    throw new Error(`--host ${host} is not present on a local network interface.`)
  }
  return host
}

export function parsePort(value) {
  if (value === undefined || value === null || String(value).trim() === '') throw new Error('Missing --port value.')
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`Invalid --port “${value}”; use an integer from 0 to 65535.`)
  return port
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > MAX_REQUEST_BYTES) throw new RequestTooLargeError('Review sandbox request exceeds the 40 MB limit.')
    chunks.push(buffer)
  }
  return Buffer.concat(chunks)
}

const MIME_TYPES = {
  '.mp4': 'video/mp4', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm',
}
const contentType = filename => MIME_TYPES[path.extname(filename)] || 'application/octet-stream'

async function indexStaticUi(root) {
  const files = new Map()
  if (!root) return files // HTTP contract tests need no UI build or browser.
  const visit = async directory => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(filename)
      else if (entry.isFile()) files.set('/' + path.relative(root, filename).split(path.sep).join('/'), filename)
    }
  }
  await visit(root)
  return files
}

async function sendFile(request, response, filename) {
  const stat = await fs.stat(filename)
  const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/)
  const baseHeaders = { 'content-type': contentType(filename), 'accept-ranges': 'bytes', 'cache-control': 'no-store' }
  if (!range) {
    response.writeHead(200, { ...baseHeaders, 'content-length': stat.size })
    if (request.method === 'HEAD') response.end()
    else createReadStream(filename).on('error', () => response.destroy()).pipe(response)
    return
  }
  const start = Number(range[1])
  const end = Math.min(stat.size - 1, range[2] ? Number(range[2]) : stat.size - 1)
  if (start > end || start >= stat.size) {
    response.writeHead(416, { 'content-range': `bytes */${stat.size}` })
    response.end()
    return
  }
  response.writeHead(206, {
    ...baseHeaders,
    'content-length': end - start + 1,
    'content-range': `bytes ${start}-${end}/${stat.size}`,
  })
  if (request.method === 'HEAD') response.end()
  else createReadStream(filename, { start, end }).on('error', () => response.destroy()).pipe(response)
}

function listen(server, host, port) {
  return new Promise((resolve, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error) }
    const onListening = () => { server.off('error', onError); resolve(server.address().port) }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen({ host, port })
  })
}

function closeServer(server) {
  return new Promise(resolve => {
    if (!server.listening) { resolve(); return }
    server.close(() => resolve())
  })
}

function publicOrigin(host, port) {
  return `http://${host}:${port}`
}

function outputName(kind, extension) {
  const id = randomUUID()
  return kind === 'scene' ? `review-${id}.maestro-scene.json` : `review-${id}_3d_scene.${extension}`
}

/**
 * Serves a prebuilt UI behind a deliberately tiny, provider-free
 * HTTP sandbox. The returned server owns only the fresh output directory and
 * an in-memory output index; nothing is recovered after a process restart.
 */
export async function startReviewServer({ uiDist, outputDir, host = LOOPBACK_HOST, port = 0 }) {
  const listenHost = validateListenHost(host)
  const requestedPort = parsePort(port)
  const exportsDir = path.join(outputDir, 'exports')
  const previewsDir = path.join(outputDir, 'previews')
  await fs.mkdir(exportsDir, { recursive: true })
  await fs.mkdir(previewsDir, { recursive: true })

  const uiFiles = await indexStaticUi(uiDist)
  const outputs = []
  const files = new Map()
  const metadata = new Map()
  const blocked = []
  const previewFiles = new Set()
  let closed = false

  const remember = ({ name, type, size, params, filename }) => {
    const item = {
      name,
      type,
      mode: type === 'video' ? '3d-scene-compositor' : type,
      size,
      created_at: Date.now() / 1000,
      favorite: false,
      url: `/api/v1/file/${encodeURIComponent(name)}?workspace=default`,
    }
    outputs.unshift(item)
    files.set(name, filename)
    metadata.set(name, { params })
    return item
  }

  const allowedOrigins = new Set()
  const allowedHosts = new Set()
  const addAllowedOrigins = actualPort => {
    allowedOrigins.add(publicOrigin(LOOPBACK_HOST, actualPort))
    allowedOrigins.add(publicOrigin('localhost', actualPort))
    if (listenHost !== LOOPBACK_HOST) allowedOrigins.add(publicOrigin(listenHost, actualPort))
    allowedHosts.add(`${LOOPBACK_HOST}:${actualPort}`)
    allowedHosts.add(`localhost:${actualPort}`)
    if (listenHost !== LOOPBACK_HOST) allowedHosts.add(`${listenHost}:${actualPort}`)
  }

  const hostAllowed = request => {
    const host = request.headers.host
    return typeof host === 'string' && allowedHosts.has(host.toLowerCase())
  }

  const rejectForeignHost = (request, response) => {
    if (hostAllowed(request)) return false
    json(response, { detail: 'Review sandbox rejects an untrusted Host header.' }, 403)
    return true
  }

  const originAllowed = request => {
    const origin = request.headers.origin
    return !origin || allowedOrigins.has(origin)
  }

  const rejectForeignOrigin = (request, response) => {
    if (originAllowed(request)) return false
    json(response, { detail: 'Review sandbox rejects cross-origin writes.' }, 403)
    return true
  }

  const handler = async (request, response) => {
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1')
      const pathname = url.pathname
      if (rejectForeignHost(request, response)) return
      if (request.method !== 'GET' && request.method !== 'HEAD' && rejectForeignOrigin(request, response)) return

      if (request.method === 'GET' && pathname === '/api/v1/scene-template-review/status') {
        json(response, {
          sandbox: true,
          providers: 'blocked',
          real_apps: 'untouched',
          outputDir,
          outputCount: outputs.length,
          blocked: [...blocked],
        })
        return
      }
      if (request.method === 'GET' && pathname === '/api/v1/outputs') {
        const type = url.searchParams.get('media_type')
        const listed = type ? outputs.filter(item => item.type === type) : outputs
        json(response, { outputs: listed, total: listed.length })
        return
      }
      if (request.method === 'GET' && pathname === '/api/v1/character-kits/library') {
        json(response, { version: 1, revision: 0, activeId: '', kits: {} })
        return
      }
      const metadataMatch = pathname.match(/^\/api\/v1\/outputs\/([^/]+)\/metadata$/)
      if (request.method === 'GET' && metadataMatch) {
        const name = decodeURIComponent(metadataMatch[1])
        json(response, metadata.get(name) || {}, metadata.has(name) ? 200 : 404)
        return
      }
      const fileMatch = pathname.match(/^\/api\/v1\/file\/([^/]+)$/)
      if ((request.method === 'GET' || request.method === 'HEAD') && fileMatch) {
        const name = decodeURIComponent(fileMatch[1])
        const filename = files.get(name)
        if (!filename) { json(response, { detail: 'Unknown review output.' }, 404); return }
        await sendFile(request, response, filename)
        return
      }
      const previewMatch = pathname.match(PREVIEW_PATH)
      if ((request.method === 'GET' || request.method === 'HEAD') && previewMatch) {
        const name = path.basename(previewMatch[1] + '.' + previewMatch[2])
        if (!previewFiles.has(name)) { json(response, { detail: 'Preview is not available.' }, 404); return }
        await sendFile(request, response, path.join(previewsDir, name))
        return
      }
      if (request.method === 'POST' && pathname === '/api/v1/scenes') {
        const payload = JSON.parse((await readBody(request)).toString('utf8'))
        if (!payload.scene || payload.scene.version !== 1 || !Array.isArray(payload.scene.layers)) throw new Error('Expected editable scene snapshot.')
        const name = outputName('scene', 'json')
        const filename = path.join(exportsDir, name)
        const bytes = Buffer.from(JSON.stringify(payload.scene, null, 2))
        await fs.writeFile(filename, bytes, { flag: 'wx' })
        const saved = remember({ name, type: 'scene', size: bytes.length, params: { scene: payload.scene, preview: payload.preview }, filename })
        json(response, { ...saved, thumbnail_url: payload.preview || null })
        return
      }
      if (request.method === 'POST' && pathname === '/api/v1/scenes/recordings') {
        const raw = await readBody(request)
        const formRequest = new Request('http://review-sandbox.local/', {
          method: 'POST',
          headers: { 'content-type': request.headers['content-type'] || '' },
          body: raw,
        })
        const form = await formRequest.formData()
        const video = form.get('file')
        const params = JSON.parse(String(form.get('metadata') || '{}'))
        if (!video || typeof video.arrayBuffer !== 'function' || !params.scene || !Array.isArray(params.scene.layers)) throw new Error('Expected recording and editable scene snapshot.')
        const bytes = Buffer.from(await video.arrayBuffer())
        if (bytes.subarray(4, 8).toString('ascii') !== 'ftyp') throw new Error('Expected MP4 recording; no silent fake conversion is accepted.')
        const name = outputName('video', 'mp4')
        const filename = path.join(exportsDir, name)
        await fs.writeFile(filename, bytes, { flag: 'wx' })
        await fs.writeFile(path.join(exportsDir, `${name}.metadata.json`), JSON.stringify({ params }, null, 2), { flag: 'wx' })
        console.log(`RECORDED template=${params.scene.narrative?.templateId || 'unknown'} name=${name} bytes=${bytes.length}`)
        json(response, remember({ name, type: 'video', size: bytes.length, params, filename }))
        return
      }
      if (pathname.startsWith('/api/') || pathname.startsWith('/classic')) {
        if (blocked.length >= MAX_BLOCKED_REQUESTS) blocked.shift()
        blocked.push(`${request.method} ${pathname}`)
        json(response, { detail: 'Isolated review sandbox: generators, model downloads and other application APIs are disabled.' }, 403)
        return
      }
      const uiFile = uiFiles.get(pathname === '/' || pathname === '/scene-template-review' ? '/index.html' : pathname)
      if (uiFile && (request.method === 'GET' || request.method === 'HEAD')) {
        await sendFile(request, response, uiFile)
        return
      }
      json(response, { detail: 'Not found.' }, 404)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const status = error instanceof RequestTooLargeError ? 413 : message.includes('ENOENT') ? 404 : 400
      json(response, { detail: message }, status)
    }
  }

  const makeHttpServer = () => http.createServer((request, response) => { void handler(request, response) })
  const servers = [makeHttpServer()]
  let actualPort
  try {
    actualPort = await listen(servers[0], LOOPBACK_HOST, requestedPort)
    addAllowedOrigins(actualPort)
    if (listenHost !== LOOPBACK_HOST) {
      const lanServer = makeHttpServer()
      servers.push(lanServer)
      await listen(lanServer, listenHost, actualPort)
    }
  } catch (error) {
    await Promise.all(servers.map(closeServer))
    throw error
  }

  const close = async () => {
    if (closed) return
    closed = true
    await Promise.all(servers.map(closeServer))
  }
  const registerPreview = name => {
    if (!PREVIEW_PATH.test(`/scene-template-previews/${name}`)) throw new Error(`Unsafe preview name “${name}”.`)
    previewFiles.add(name)
  }
  const localOrigin = publicOrigin(LOOPBACK_HOST, actualPort)
  return {
    close,
    outputDir,
    exportsDir,
    previewsDir,
    localOrigin,
    lanOrigin: listenHost === LOOPBACK_HOST ? null : publicOrigin(listenHost, actualPort),
    port: actualPort,
    blocked,
    registerPreview,
    snapshot: () => ({ outputs: outputs.map(item => ({ ...item })), blocked: [...blocked] }),
  }
}

export { MAX_BLOCKED_REQUESTS, MAX_REQUEST_BYTES, LOOPBACK_HOST }
