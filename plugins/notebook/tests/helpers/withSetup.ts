import { createApp } from 'vue'

/**
 * Runs a composable inside a throwaway Vue app so lifecycle hooks
 * (onMounted/onUnmounted/watch) behave normally. Returns the composable
 * result plus an unmount() to trigger cleanup.
 */
export function withSetup<T>(composable: () => T): [T, () => void] {
  let result!: T
  const app = createApp({
    setup() {
      result = composable()
      return () => null
    },
  })
  app.mount(document.createElement('div'))
  return [result, () => app.unmount()]
}
