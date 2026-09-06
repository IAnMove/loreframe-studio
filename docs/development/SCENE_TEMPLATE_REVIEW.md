# Scene Template Review sandbox

This tool reviews the candidate SceneTemplate catalog through the real
`SceneTemplateReviewPage` and `SceneAnimatorPanel`. It does not call a video
provider, an LLM, a model download service or another HocusPocus application.
Images and GLBs come from the catalog's procedural data URIs. MP4 export is the
existing browser compositor/exporter running under Playwright Chromium.

## Run

From the repository root:

```bash
npm --prefix ui run scene:review
```

The equivalent command from `ui/` is:

```bash
npm run scene:review
```

The default binds only `127.0.0.1` on an ephemeral port, creates a fresh
directory under the OS temporary directory, and prints:

```text
REVIEW_OUTPUT_DIR=/tmp/hocus-scene-template-review-…
REVIEW_URL_LOCAL=http://127.0.0.1:…/scene-template-review
```

The process remains open so the user can inspect the gallery and editor. Stop
it with Ctrl-C. The in-memory output index is intentionally not recovered after
a restart; the fresh directory remains available for inspection.

To render every candidate with the real browser exporter and leave the server
open afterwards:

```bash
npm --prefix ui run scene:review -- --render
```

Specific IDs may be appended after `--render` for a short review, for example
`--render cinema-establishing space-cruise`. A render failure sets exit code 1
and writes a `status: "render-failed"` JSON record. It never creates a fake
MP4, PNG or success record in place of the failure.

The provider-free HTTP contract can be checked without a browser or render:

```bash
cd ui
npm exec --offline -- tsx --tsconfig tsconfig.app.json --test tests/sceneTemplateReviewServer.test.mjs
```

LAN review is opt-in and accepts only an RFC1918 IPv4 address that is present
on a local network interface:

```bash
npm --prefix ui run scene:review -- --host YOUR_LOCAL_PRIVATE_IPV4
```

Replace `YOUR_LOCAL_PRIVATE_IPV4` with an address on your own local interface;
omit `--port` to avoid collisions. This is a local development tool, not a public
server: do not expose it through port forwarding or an internet tunnel.
Dependencies must already be installed with the repository's UI setup. Rendering
requires the Playwright Chromium browser, plus `ffmpeg` and `ffprobe` on PATH.
The tool does not install them or download anything automatically.

Wildcard binds (`0.0.0.0`), public addresses and non-local hostnames are
rejected. The tool still prints the loopback URL; when LAN mode is enabled it
also prints `REVIEW_URL_LAN`.

## Sandbox contract

- The actual UI is built by Vite into the run's temporary `ui/` directory and
  served as indexed static files, not through a development server. There is no
  HMR/websocket or source-file endpoint. `/api` and `/classic` never proxy to the
  live backend. Known review routes are handled locally; unknown
  application APIs return HTTP 403 and are recorded by the status endpoint
  with a bounded diagnostic list.
- Every request must carry a `Host` header for the served loopback address
  (`127.0.0.1`, `localhost`, or the explicitly selected local RFC1918 address)
  and port. This keeps a loopback socket from accepting a DNS-rebinding host.
- POST requests with an `Origin` other than the served host or loopback on the
  same port return HTTP 403 before reading or writing a body.
- Request bodies are capped at 40 MB. Saved scene and recording names are
  generated UUIDs; file reads resolve through the server's in-memory index, not
  arbitrary paths supplied by a URL.
- Scene saves and MP4 recordings are written only below the run's `exports/`
  directory. Render previews and metadata are written only below `previews/`.
- The editable scene is saved and read back before each MP4 export. Each
  successful template has `<template-id>.mp4`, `<template-id>.png`, and
  `<template-id>.json`. Metadata includes catalog/template versions, variant,
  render status, source HEAD SHA, dirty state, MP4 SHA-256, dimensions,
  duration, measured FPS, editable-scene filename/hash, and the exact scene
  snapshot sent to the recording endpoint. A preview is published only after
  page-error, `ffprobe` dimensions/FPS/duration, and metadata checks pass.
- Failed renders receive a uniquely named `*.failure-<uuid>.json` record. The
  failure path never overwrites a success record or masks the original error
  when a same-name write is not available.
- The status is `rendered-not-approved`: a correct local render is evidence for
  review only, never an automatic catalog approval.

The HTTP status endpoint is available at
`/api/v1/scene-template-review/status` while the process is running. It reports
the blocked API paths and the current in-memory output count without claiming
durable persistence.
