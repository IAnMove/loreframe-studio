import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { after, before, test } from 'node:test'
import {
  MAX_BLOCKED_REQUESTS,
  startReviewServer,
} from '../scripts/sceneTemplateReview/server.mjs'

const scene = {
  version: 1,
  name: 'HTTP sandbox scene',
  width: 1280,
  height: 720,
  fps: 30,
  duration: 4,
  layers: [{
    id: 'hero',
    name: 'hero',
    type: 'image',
    source: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
    visible: true,
    z: 1,
  }],
  narrative: { templateId: 'http-sandbox-test', variant: 'coral' },
}
const preview = 'data:image/png;base64,iVBORw0KGgo='
const mp4Bytes = Buffer.from([
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0,
  0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
])

let outputDir
let server

before(async () => {
  outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hocus-scene-template-review-test-'))
  const uiDist = path.join(outputDir, 'ui')
  await fs.mkdir(uiDist)
  await fs.writeFile(path.join(uiDist, 'index.html'), '<!doctype html><title>Test fixture</title>')
  server = await startReviewServer({ uiDist, outputDir, host: '127.0.0.1', port: 0 })
})

after(async () => {
  await server?.close()
  if (outputDir) await fs.rm(outputDir, { recursive: true, force: true })
})

const url = pathname => `${server.localOrigin}${pathname}`

const requestWithHeaders = (pathname, headers) => new Promise((resolve, reject) => {
  const target = new URL(url(pathname))
  const request = http.request({
    hostname: target.hostname,
    port: target.port,
    path: `${target.pathname}${target.search}`,
    headers,
  }, response => {
    response.resume()
    response.once('end', () => resolve(response))
  })
  request.once('error', reject)
  request.end()
})

test('rejects unknown APIs with bounded blocked diagnostics', async () => {
  const first = await fetch(url('/api/v1/unknown-provider'))
  assert.equal(first.status, 403)

  for (let index = 0; index < MAX_BLOCKED_REQUESTS + 12; index += 1) {
    const response = await fetch(url(`/api/v1/unknown-provider-${index}`))
    assert.equal(response.status, 403)
  }
  const status = await fetch(url('/api/v1/scene-template-review/status'))
  const body = await status.json()
  assert.equal(status.status, 200)
  assert.ok(body.blocked.length <= MAX_BLOCKED_REQUESTS)
})

test('rejects a foreign Origin before writing outputs', async () => {
  const response = await fetch(url('/api/v1/scenes'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://foreign.example',
    },
    body: JSON.stringify({ scene, preview }),
  })
  assert.equal(response.status, 403)

  const outputs = await fetch(url('/api/v1/outputs'))
  const body = await outputs.json()
  assert.equal(outputs.status, 200)
  assert.equal(body.total, 0)
})

test('rejects a foreign Host header, including a loopback socket', async () => {
  const response = await requestWithHeaders('/api/v1/scene-template-review/status', { Host: 'evil.example' })
  assert.equal(response.statusCode, 403)
})

test('does not resolve traversal names through the output index', async () => {
  const response = await fetch(url('/api/v1/file/%2e%2e%2fetc%2fpasswd'))
  assert.equal(response.status, 404)
})

test('serves only indexed built UI files, with no dev source routes or backend proxy', async () => {
  const response = await fetch(url('/scene-template-review?editor=1'))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /text\/html/)
  assert.match(await response.text(), /Test fixture/)
  assert.equal((await fetch(url('/@fs/etc/passwd'))).status, 404)
  assert.equal((await fetch(url('/@vite/client'))).status, 404)
  assert.equal((await fetch(url('/src/main.tsx'))).status, 404)
})

test('failure evidence has a safe indexed filename without overwriting a success', async () => {
  const filename = 'test.failure-12345678-abcd.json'
  await fs.writeFile(path.join(server.previewsDir, filename), JSON.stringify({ status: 'render-failed' }))
  server.registerPreview(filename)
  const response = await fetch(url(`/scene-template-previews/${filename}`))
  assert.equal(response.status, 200)
  assert.equal((await response.json()).status, 'render-failed')
  assert.throws(() => server.registerPreview('../outside.json'), /Unsafe/)
})

test('saves an editable scene and returns exact metadata through the output endpoint', async () => {
  const response = await fetch(url('/api/v1/scenes'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ scene, preview, workspace: 'default' }),
  })
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.match(saved.name, /^review-[0-9a-f-]+\.maestro-scene\.json$/)

  const metadata = await fetch(url(`/api/v1/outputs/${encodeURIComponent(saved.name)}/metadata`))
  assert.equal(metadata.status, 200)
  assert.deepEqual((await metadata.json()).params.scene, scene)

  const file = await fetch(url(`/api/v1/file/${encodeURIComponent(saved.name)}?workspace=default`))
  assert.equal(file.status, 200)
  assert.deepEqual(JSON.parse(await file.text()), scene)
})

test('records MP4 with compositor mode and supports range and HEAD reads', async () => {
  const form = new FormData()
  form.append('file', new Blob([mp4Bytes], { type: 'video/mp4' }), 'scene.mp4')
  form.append('metadata', JSON.stringify({ scene, workspace: 'default' }))
  const response = await fetch(url('/api/v1/scenes/recordings'), { method: 'POST', body: form })
  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.mode, '3d-scene-compositor')
  assert.equal(saved.type, 'video')

  const metadata = await fetch(url(`/api/v1/outputs/${encodeURIComponent(saved.name)}/metadata`))
  assert.equal(metadata.status, 200)
  assert.deepEqual((await metadata.json()).params.scene, scene)

  const range = await fetch(url(`/api/v1/file/${encodeURIComponent(saved.name)}`), {
    headers: { Range: 'bytes=4-7' },
  })
  assert.equal(range.status, 206)
  assert.equal(range.headers.get('content-range'), `bytes 4-7/${mp4Bytes.length}`)
  assert.deepEqual(Buffer.from(await range.arrayBuffer()), Buffer.from('ftyp'))

  const head = await fetch(url(`/api/v1/file/${encodeURIComponent(saved.name)}`), { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(Number(head.headers.get('content-length')), mp4Bytes.length)
  assert.equal((await head.arrayBuffer()).byteLength, 0)
})
