// httpuv service worker — bridges iframe HTTP requests to the main page
// Based on georgestagg/shiny-standalone-webr-demo

const requests = {}
const clients = {}

function uuid() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

function promiseHandles() {
  const out = { resolve: null, reject: null, promise: null }
  const p = new Promise((resolve, reject) => {
    out.resolve = resolve
    out.reject = reject
  })
  out.promise = p
  return out
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (/\/__wasm__\/([0-9a-fA-F-]{36})/.test(url.pathname)) {
    event.respondWith(handleFetch(event))
  }
})

async function handleFetch(event) {
  const url = new URL(event.request.url)
  const match = url.pathname.match(/__wasm__\/([0-9a-fA-F-]{36})/)
  if (!match) return new Response('Not found', { status: 404 })

  const clientId = match[1]
  const client = clients[clientId]
  if (!client) return new Response('Client not registered', { status: 404 })

  const id = uuid()
  const handles = promiseHandles()
  requests[id] = handles

  let body = undefined
  if (event.request.method !== 'GET' && event.request.method !== 'HEAD') {
    body = await event.request.arrayBuffer()
  }

  client.postMessage({
    type: 'wasm-http-fetch',
    uuid: id,
    url: event.request.url,
    method: event.request.method,
    body: body,
  })

  const response = await handles.promise

  const headers = {}
  for (let i = 0; i < response.headers.names.length; i++) {
    headers[response.headers.names[i]] = response.headers.values[i]
  }
  headers['Cross-Origin-Embedder-Policy'] = 'credentialless'
  headers['Cross-Origin-Resource-Policy'] = 'cross-origin'

  const body_out = response.body.type === 'raw'
    ? new Uint8Array(response.body.values)
    : response.body.values[0]

  return new Response(body_out, {
    status: response.status.values[0],
    headers: headers,
  })
}

self.addEventListener('message', (event) => {
  if (event.data.type === 'register-client') {
    const clientId = event.source?.id
    if (clientId) {
      clients[clientId] = event.source
      event.source.postMessage({ type: 'registration-successful', clientId })
    }
  } else if (event.data.type === 'wasm-http-response') {
    if (requests[event.data.uuid]) {
      requests[event.data.uuid].resolve(event.data.response)
      delete requests[event.data.uuid]
    }
  }
})
