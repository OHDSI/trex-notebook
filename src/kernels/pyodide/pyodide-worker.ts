import type { PyodideInterface } from 'pyodide'
import strategusSpecBuilderSource from './strategus_spec_builder.py?raw'

// Import all pyqe package files as raw strings for virtual filesystem installation
const pyqeModules: Record<string, string> = import.meta.glob('./pyqe/**/*.py', {
  query: '?raw',
  eager: true,
  import: 'default',
}) as Record<string, string>

export interface WorkerRequest {
  type: 'init' | 'execute' | 'interrupt'
  id: string
  code?: string
  indexUrl?: string
  preloadPackages?: string[]
}

export interface WorkerResponse {
  type: 'ready' | 'stdout' | 'stderr' | 'result' | 'error' | 'status' | 'display_data'
  id: string
  data?: unknown
}

let pyodide: PyodideInterface | null = null
let isInitialized = false
let currentExecutionId: string | null = null

function sendMessage(msg: WorkerResponse) {
  self.postMessage(msg)
}

async function initialize(indexUrl?: string, preloadPackages?: string[]) {
  if (isInitialized) return

  sendMessage({ type: 'status', id: '', data: { state: 'connecting' } })

  try {
    const pyodideModule = await import('pyodide')

    pyodide = await pyodideModule.loadPyodide({
      indexURL: indexUrl || 'https://cdn.jsdelivr.net/pyodide/v0.29.0/full/',
      stdout: (text: string) => {
        if (currentExecutionId) {
          sendMessage({ type: 'stdout', id: currentExecutionId, data: text })
        }
      },
      stderr: (text: string) => {
        if (currentExecutionId) {
          sendMessage({ type: 'stderr', id: currentExecutionId, data: text })
        }
      },
    })

    if (preloadPackages && preloadPackages.length > 0) {
      await pyodide.loadPackagesFromImports(`import micropip`)
      const micropip = pyodide.pyimport('micropip')
      for (const pkg of preloadPackages) {
        try {
          await micropip.install(pkg)
        } catch (e) {
          console.warn(`Failed to install ${pkg}:`, e)
        }
      }
    }

    // Matplotlib figure capture helper (lazy imports inside function body)
    pyodide.runPython(`
def _capture_open_figures():
    try:
        import matplotlib.pyplot as plt
        import base64, io
    except ImportError:
        return []
    figs = [plt.figure(n) for n in plt.get_fignums()]
    results = []
    for fig in figs:
        buf = io.BytesIO()
        fig.savefig(buf, format='png', bbox_inches='tight', dpi=100)
        buf.seek(0)
        results.append(base64.b64encode(buf.read()).decode('utf-8'))
    plt.close('all')
    return results
`)

    // Autoload Strategus spec builder library
    try {
      pyodide.runPython(strategusSpecBuilderSource)
    } catch (e) {
      console.warn('Failed to load Strategus spec builder:', e)
    }

    // Autoload pyqe package into Pyodide virtual filesystem
    try {
      for (const [importPath, source] of Object.entries(pyqeModules)) {
        // Convert import path (e.g. "./pyqe/api/base.py") to FS path
        const fsPath = '/home/pyodide/' + importPath.replace('./', '')
        const dir = fsPath.substring(0, fsPath.lastIndexOf('/'))
        pyodide.runPython(`
import os
os.makedirs("${dir}", exist_ok=True)
`)
        pyodide.FS.writeFile(fsPath, source)
      }
      // Add to Python path so "import pyqe" works
      pyodide.runPython(`
import sys
if "/home/pyodide" not in sys.path:
    sys.path.insert(0, "/home/pyodide")
`)
    } catch (e) {
      console.warn('Failed to load pyqe package:', e)
    }

    isInitialized = true
    sendMessage({ type: 'ready', id: '' })
    sendMessage({ type: 'status', id: '', data: { state: 'idle' } })
  } catch (error) {
    sendMessage({
      type: 'error',
      id: '',
      data: {
        ename: 'InitializationError',
        evalue: error instanceof Error ? error.message : String(error),
        traceback: [],
      },
    })
    sendMessage({ type: 'status', id: '', data: { state: 'error' } })
  }
}

async function execute(id: string, code: string) {
  if (!pyodide || !isInitialized) {
    sendMessage({
      type: 'error',
      id,
      data: {
        ename: 'NotInitializedError',
        evalue: 'Pyodide is not initialized',
        traceback: [],
      },
    })
    return
  }

  currentExecutionId = id
  sendMessage({ type: 'status', id, data: { state: 'busy' } })

  try {
    // loadPackagesFromImports is unreliable in Pyodide 0.29+; use find_imports instead
    try {
      pyodide.globals.set('__user_code__', code)
      const importsProxy = pyodide.runPython(
        'from pyodide.code import find_imports as _fi; list(_fi(__user_code__))'
      )
      const imports: string[] = importsProxy.toJs()
      importsProxy.destroy()
      pyodide.globals.delete('__user_code__')
      if (imports.length > 0) {
        await pyodide.loadPackage(imports)
      }
    } catch {
      // Fallback to loadPackagesFromImports
      await pyodide.loadPackagesFromImports(code)
    }

    // Force non-interactive backend before user code imports matplotlib
    try {
      pyodide.runPython(`
try:
    import matplotlib
    matplotlib.use('agg')
except ImportError:
    pass
`)
    } catch {
      // matplotlib not available
    }

    const result = await pyodide.runPythonAsync(code)

    // Skip matplotlib figure objects in result display
    if (result !== undefined && result !== null) {
      const resultStr = String(result)
      if (!resultStr.includes('matplotlib.figure.Figure')) {
        let repr = resultStr
        try {
          repr = pyodide.runPython(`repr(${code.split('\n').pop()})`) || resultStr
        } catch {
          // fall back to string representation
        }
        sendMessage({
          type: 'result',
          id,
          data: {
            'text/plain': repr,
          },
        })
      }
    }

    try {
      const figuresProxy = await pyodide.runPythonAsync('_capture_open_figures()')
      const figures = figuresProxy.toJs() as string[]
      for (const imgData of figures) {
        sendMessage({
          type: 'display_data',
          id,
          data: {
            'image/png': imgData,
          },
        })
      }
      figuresProxy.destroy()
    } catch {
      // no figures or matplotlib not available
    }

    sendMessage({ type: 'status', id, data: { state: 'idle' } })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const traceback = error instanceof Error && error.stack ? error.stack.split('\n') : []

    sendMessage({
      type: 'error',
      id,
      data: {
        ename: error instanceof Error ? error.constructor.name : 'Error',
        evalue: errorMessage,
        traceback,
      },
    })
    sendMessage({ type: 'status', id, data: { state: 'idle' } })
  } finally {
    currentExecutionId = null
  }
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { type, id, code, indexUrl, preloadPackages } = event.data

  switch (type) {
    case 'init':
      await initialize(indexUrl, preloadPackages)
      break
    case 'execute':
      if (code) {
        await execute(id, code)
      }
      break
    case 'interrupt':
      // Currently handled by terminating the worker; SharedArrayBuffer could enable graceful interrupt
      break
  }
}
