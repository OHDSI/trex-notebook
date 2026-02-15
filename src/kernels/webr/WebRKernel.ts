import type {
  KernelPlugin,
  KernelConfig,
  KernelOutput,
  KernelStatus,
  WebRKernelConfig,
} from '../types'
import { KernelConnectionError } from '../types'
import strategusSpecBuilderSource from './StrategusSpecBuilder.R?raw'

export class WebRKernel implements KernelPlugin {
  readonly id = 'webr'
  readonly name = 'R (WebR)'
  readonly languages: ReadonlyArray<'python' | 'r'> = ['r']

  private _status: KernelStatus = 'disconnected'
  private statusCallbacks: Set<(status: KernelStatus) => void> = new Set()
  private webR: unknown = null
  private config: WebRKernelConfig | null = null
  private executionCount = 0

  get status(): KernelStatus {
    return this._status
  }

  private setStatus(status: KernelStatus) {
    this._status = status
    this.statusCallbacks.forEach((cb) => cb(status))
  }

  async connect(config: KernelConfig): Promise<void> {
    if (config.type !== 'webr') {
      throw new KernelConnectionError('Invalid config type for WebRKernel')
    }

    this.config = config
    this.setStatus('connecting')

    try {
      const { WebR } = await import('webr')

      this.webR = new WebR()

      await (this.webR as { init: () => Promise<void> }).init()

      if (config.preloadPackages && config.preloadPackages.length > 0) {
        for (const pkg of config.preloadPackages) {
          try {
            await (
              this.webR as {
                evalRVoid: (code: string) => Promise<void>
              }
            ).evalRVoid(`webr::install("${pkg}")`)
          } catch (e) {
            console.warn(`Failed to install ${pkg}:`, e)
          }
        }
      }

      // Autoload Strategus spec builder library
      try {
        // Install checkmate dependency (required by StrategusSpecBuilder.R)
        await (
          this.webR as {
            evalRVoid: (code: string) => Promise<void>
          }
        ).evalRVoid(`webr::install("checkmate")`)
        await (
          this.webR as {
            evalRVoid: (code: string) => Promise<void>
          }
        ).evalRVoid(strategusSpecBuilderSource)
      } catch (e) {
        console.warn('Failed to load Strategus spec builder:', e)
      }

      this.setStatus('idle')
    } catch (error) {
      this.setStatus('error')
      throw new KernelConnectionError(
        error instanceof Error ? error.message : 'Failed to initialize WebR',
        error instanceof Error ? error : undefined
      )
    }
  }

  async disconnect(): Promise<void> {
    if (this.webR) {
      try {
        await (this.webR as { close: () => Promise<void> }).close()
      } catch {
        // ignore
      }
      this.webR = null
    }
    this.setStatus('disconnected')
  }

  async *execute(code: string, language: 'python' | 'r'): AsyncIterable<KernelOutput> {
    if (language !== 'r') {
      throw new Error('WebRKernel only supports R')
    }

    if (!this.webR || this._status === 'disconnected') {
      throw new Error('Kernel is not connected')
    }

    this.executionCount++
    const execCount = this.executionCount
    this.setStatus('busy')

    try {
      const webR = this.webR as {
        evalR: (code: string) => Promise<unknown>
        Shelter: new () => Promise<{
          captureR: (
            code: string
          ) => Promise<{
            output: Array<{ type: string; data: string }>
            images: string[]
            result: unknown
          }>
          purge: () => void
        }>
      }

      // Shelter provides safe R evaluation with automatic cleanup
      const Shelter = await new webR.Shelter()

      try {
        const result = await Shelter.captureR(code)

        for (const output of result.output) {
          yield {
            type: 'stream',
            name: output.type === 'stderr' ? 'stderr' : 'stdout',
            text: output.data,
          } as KernelOutput
        }

        for (const imageData of result.images) {
          yield {
            type: 'display_data',
            data: {
              'image/png': imageData,
            },
          } as KernelOutput
        }

        if (result.result !== null && result.result !== undefined) {
          try {
            const resultStr = String(result.result)
            if (resultStr && resultStr !== '[object Object]') {
              yield {
                type: 'execute_result',
                executionCount: execCount,
                data: {
                  'text/plain': resultStr,
                },
              } as KernelOutput
            }
          } catch {
            // proxy can't be converted to string
          }
        }
      } finally {
        Shelter.purge()
      }

      this.setStatus('idle')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const traceback = error instanceof Error && error.stack ? error.stack.split('\n') : []

      yield {
        type: 'error',
        ename: error instanceof Error ? error.constructor.name : 'Error',
        evalue: errorMessage,
        traceback,
      } as KernelOutput

      this.setStatus('idle')
    }
  }

  async interrupt(): Promise<void> {
    if (this.webR) {
      try {
        await (this.webR as { interrupt: () => void }).interrupt()
      } catch {
        // Interrupt failed, recreate the kernel
        await this.disconnect()
        if (this.config) {
          await this.connect(this.config)
        }
      }
    }
    this.setStatus('idle')
  }

  onStatusChange(callback: (status: KernelStatus) => void): () => void {
    this.statusCallbacks.add(callback)
    return () => {
      this.statusCallbacks.delete(callback)
    }
  }
}
