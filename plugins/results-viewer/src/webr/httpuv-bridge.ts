import type { WebR } from 'webr'
import { pluginBase } from '../pluginBase'

let clientId: string | null = null
let swRegistration: ServiceWorkerRegistration | null = null
let webSocketHandleCounter = 0
const webSocketRefs: Record<number, WebSocketProxy> = {}
let httpuvReadyResolve: (() => void) | null = null
const httpuvReady = new Promise<void>((resolve) => { httpuvReadyResolve = resolve })

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser')
  }

  const basePath = pluginBase()
  swRegistration = await navigator.serviceWorker.register(
    `${basePath}httpuv-serviceworker.js`,
    { scope: basePath }
  )

  // Wait for the SW to be ready and controlling this page
  await navigator.serviceWorker.ready

  // If the SW isn't yet the controller (first install), we need to wait
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  }

  // Get the client ID — this is the browser-assigned ID for this page/tab.
  // The SW uses it to route responses back to us.
  clientId = await new Promise<string>((resolve) => {
    const listener = (event: MessageEvent) => {
      if (event.data.type === 'registration-successful') {
        navigator.serviceWorker.removeEventListener('message', listener)
        resolve(event.data.clientId)
      }
    }
    navigator.serviceWorker.addEventListener('message', listener)
    navigator.serviceWorker.controller!.postMessage({ type: 'register-client' })
  })
}

export async function startHttpuvBridge(webR: WebR): Promise<void> {
  // Listen for HTTP fetch requests from the service worker
  navigator.serviceWorker.addEventListener('message', async (event: MessageEvent) => {
    if (event.data.type === 'wasm-http-fetch') {
      const url = new URL(event.data.url)
      const pathname = url.pathname.replace(/.*\/__wasm__\/([0-9a-fA-F-]{36})/, '')
      const query = url.search.replace(/^\?/, '')
      const method = event.data.method || 'GET'
      const uuid = event.data.uuid

      await webR.evalRVoid(`
        onRequest <- options("webr_httpuv_onRequest")[[1]]
        if (!is.null(onRequest)) {
          onRequest(list(
            PATH_INFO = "${escapeR(pathname || '/')}",
            REQUEST_METHOD = "${escapeR(method)}",
            UUID = "${escapeR(uuid)}",
            QUERY_STRING = "${escapeR(query)}",
            HTTP_HOST = "127.0.0.1",
            httpuv.version = "1.6.15"
          ))
        }
      `)
    }
  })

  // Start the continuous read loop — this runs forever in the background,
  // forwarding all WebR messages to the appropriate handler.
  ;(async () => {
    for (;;) {
      const output = await webR.read() as any
      console.log('[httpuv-bridge] WebR msg:', output.type, output.type === 'stdout' ? output.data : '')
      switch (output.type) {
        case 'stdout':
          if (typeof output.data === 'string' && output.data.includes('__HTTPUV_READY__')) {
            console.log('[httpuv-bridge] httpuv ready signal received')
            httpuvReadyResolve?.()
          }
          break
        case 'stderr':
          break
        case '_webR_httpuv_TcpResponse': {
          console.log('[httpuv-bridge] Got TcpResponse, uuid:', output.uuid)
          const reg = await navigator.serviceWorker.getRegistration()
          reg?.active?.postMessage({
            type: 'wasm-http-response',
            uuid: output.uuid,
            response: output.data,
          })
          break
        }
        case '_webR_httpuv_WSResponse': {
          console.log('[httpuv-bridge] Got WSResponse, handle:', output.data?.handle)
          const wsRef = webSocketRefs[output.data.handle]
          if (wsRef && wsRef.onmessage) {
            wsRef.onmessage({ data: output.data.message } as any)
          }
          break
        }
      }
    }
  })()
}

export function getAppUrl(): string {
  if (!clientId) {
    throw new Error('httpuv bridge not started — call registerServiceWorker() first')
  }
  const scope = swRegistration?.scope ?? `${window.location.origin}${pluginBase()}`
  return `${scope}__wasm__/${clientId}/`
}

export function launchShinyApp(webR: WebR): void {
  // MUST use writeConsole, NOT evalRVoid — runApp() blocks the R thread forever.
  // The cat("__HTTPUV_READY__") is emitted by Shiny's onStart callback
  // BEFORE runApp enters its event loop, signaling that httpuv is listening.
  // Packages are already loaded by loadShimPackages + app.R eval.
  // Just start the Shiny app. cat the ready signal first.
  webR.writeConsole('cat("__HTTPUV_READY__\\n"); tryCatch(shiny::runApp(.shiny_app, launch.browser = FALSE), error = function(e) cat("RUNAPP_ERROR:", conditionMessage(e), "\\n"))\n')
}

export async function waitForHttpuvReady(timeoutMs = 30000): Promise<void> {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Timed out waiting for httpuv')), timeoutMs)
  )
  await Promise.race([httpuvReady, timeout])
}

export function injectWebSocketProxy(iframe: HTMLIFrameElement, webR: WebR): void {
  const iframeWindow = iframe.contentWindow
  if (!iframeWindow) return

  class WebSocketProxy {
    url: string
    handle: number
    readyState = 0
    bufferedAmount = 0
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onclose: (() => void) | null = null
    onerror: ((err: unknown) => void) | null = null

    constructor(_url: string) {
      this.url = _url
      this.handle = webSocketHandleCounter++
      webSocketRefs[this.handle] = this as any

      webR.evalRVoid(`
        onWSOpen <- options('webr_httpuv_onWSOpen')[[1]]
        if (!is.null(onWSOpen)) {
          onWSOpen(${this.handle}, list(handle = ${this.handle}))
        }
      `)

      setTimeout(() => {
        this.readyState = 1
        if (this.onopen) this.onopen()
      }, 0)
    }

    send(msg: string) {
      webR.evalRVoid(`
        onWSMessage <- options('webr_httpuv_onWSMessage')[[1]]
        if (!is.null(onWSMessage)) {
          onWSMessage(${this.handle}, FALSE, '${escapeR(msg)}')
        }
      `)
    }

    close() {
      this.readyState = 3
      if (this.onclose) this.onclose()
      delete webSocketRefs[this.handle]
    }
  }

  (iframeWindow as any).WebSocket = WebSocketProxy
}

function escapeR(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}
