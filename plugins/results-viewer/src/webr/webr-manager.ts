import type { WebR } from 'webr'

let webRInstance: WebR | null = null
let initPromise: Promise<WebR> | null = null
let hasSharedArrayBuffer = false

export type ProgressCallback = (message: string) => void

export async function getWebR(onProgress?: ProgressCallback): Promise<WebR> {
  if (webRInstance) return webRInstance
  if (initPromise) return initPromise

  initPromise = initWebR(onProgress)
  webRInstance = await initPromise
  return webRInstance
}

async function initWebR(onProgress?: ProgressCallback): Promise<WebR> {
  onProgress?.('Loading R runtime...')
  const { WebR } = await import('webr')

  hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined'
  const channelType = hasSharedArrayBuffer ? 1 : 3

  onProgress?.(
    hasSharedArrayBuffer
      ? 'SharedArrayBuffer available — using DuckDB'
      : 'SharedArrayBuffer unavailable — falling back to RSQLite'
  )

  const webR = new WebR({
    baseUrl: 'https://webr.r-wasm.org/v0.5.8/',
    channelType,
  })
  await webR.init()

  // Install packages in batches with progress
  onProgress?.('Installing core packages...')
  await webR.installPackages(['shiny', 'httpuv', 'jsonlite', 'DBI'], { quiet: true })

  onProgress?.('Installing database packages...')
  if (hasSharedArrayBuffer) {
    await webR.installPackages(['duckdb'], { quiet: true })
  } else {
    await webR.installPackages(['RSQLite'], { quiet: true })
  }

  onProgress?.('Installing UI packages...')
  await webR.installPackages(
    ['shinydashboard', 'reactable', 'shinyWidgets', 'shinycssloaders'],
    { quiet: true }
  )

  onProgress?.('Installing data packages...')
  await webR.installPackages(
    ['dplyr', 'tidyr', 'ggplot2', 'plotly', 'scales', 'RColorBrewer'],
    { quiet: true }
  )

  onProgress?.('R runtime ready')
  return webR
}

export async function loadShimPackages(
  webR: WebR,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.('Loading shim packages (replacing Java dependencies)...')

  const shimOrder = ['SqlRenderLite', 'DatabaseConnectorLite', 'CirceRLite', 'app']
  const shimFiles = import.meta.glob('../shims/*.R', { query: '?raw', import: 'default' })

  for (const shimName of shimOrder) {
    const path = Object.keys(shimFiles).find((p) => p.includes(shimName))
    if (!path) continue
    onProgress?.(`Loading shim: ${shimName}`)
    const code = (await shimFiles[path]()) as string
    await webR.evalRVoid(code)
  }
}

export async function writeFilesToWebRFS(
  webR: WebR,
  files: Map<string, ArrayBuffer>,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.('Writing data files to R filesystem...')

  await webR.evalRVoid('dir.create("/data", showWarnings = FALSE)')

  let i = 0
  for (const [name, buffer] of files) {
    i++
    onProgress?.(`Writing ${name} (${i}/${files.size})`)
    const uint8 = new Uint8Array(buffer)
    await webR.FS.writeFile(`/data/${name}`, uint8)
  }
}

export async function loadDataIntoDB(
  webR: WebR,
  files: Map<string, ArrayBuffer>,
  onProgress?: ProgressCallback
): Promise<void> {
  onProgress?.('Creating database connection...')

  if (hasSharedArrayBuffer) {
    await webR.evalRVoid(`
      library(DBI)
      library(duckdb)
      .results_con <- dbConnect(duckdb::duckdb())
    `)
  } else {
    await webR.evalRVoid(`
      library(DBI)
      library(RSQLite)
      .results_con <- dbConnect(RSQLite::SQLite(), ':memory:')
    `)
  }

  let i = 0
  for (const [name] of files) {
    i++
    if (!name.endsWith('.csv')) continue
    const tableName = name.replace(/\.csv$/, '')
    onProgress?.(`Loading table: ${tableName} (${i}/${files.size})`)

    await webR.evalRVoid(`
      .tmp_data <- read.csv("/data/${name}", stringsAsFactors = FALSE)
      dbWriteTable(.results_con, "${tableName}", .tmp_data, overwrite = TRUE)
      rm(.tmp_data)
    `)
  }

  // List what was loaded
  const result = await webR.evalR('paste(dbListTables(.results_con), collapse=", ")')
  const tables = await (result as any).toString()
  onProgress?.(`Loaded tables: ${tables}`)
}
