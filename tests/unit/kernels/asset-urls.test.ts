import { describe, it, expect } from 'vitest'
import { buildKernelAssetUrls } from '@/kernels/asset-urls'

describe('buildKernelAssetUrls', () => {
  it('builds local origin-relative URLs when an asset base is given (offline)', () => {
    const urls = buildKernelAssetUrls('/resources/notebook/kernel-assets', '0.29.3')
    expect(urls).toEqual({
      pyodideIndexUrl: '/resources/notebook/kernel-assets/pyodide/',
      webrBaseUrl: '/resources/notebook/kernel-assets/webr/',
      webrRepoUrl: '/resources/notebook/kernel-assets/webr-repo/',
    })
  })

  it('strips a trailing slash on the asset base', () => {
    const urls = buildKernelAssetUrls('/resources/notebook/kernel-assets/', '0.29.3')
    expect(urls.pyodideIndexUrl).toBe('/resources/notebook/kernel-assets/pyodide/')
  })

  it('falls back to the pyodide CDN and undefined WebR URLs when base is empty (dev)', () => {
    const urls = buildKernelAssetUrls('', '0.29.3')
    expect(urls).toEqual({
      pyodideIndexUrl: 'https://cdn.jsdelivr.net/pyodide/v0.29.3/full/',
      webrBaseUrl: undefined,
      webrRepoUrl: undefined,
    })
  })
})
