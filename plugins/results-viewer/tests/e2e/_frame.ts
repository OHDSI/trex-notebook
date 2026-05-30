import type { Page, Frame } from '@playwright/test'

// The OHDSI HADES viewer renders inside shinylive's nested iframe (served at
// .../shinylive/app_.../). Page-level locators can't reach it, so tests poll
// the frame tree for the app frame by its rendered content.
const DASHBOARD_RE = /cohort count|incidence|inclusion rule|data source|analysis results viewer|cohort definition/i

export async function waitForDashboardFrame(page: Page, timeout = 240000): Promise<Frame> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      const txt = await f.evaluate(() => document.body?.innerText || '').catch(() => '')
      if (DASHBOARD_RE.test(txt)) return f
    }
    await page.waitForTimeout(4000)
  }
  throw new Error('OHDSI dashboard frame did not appear within timeout')
}
