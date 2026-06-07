import { ref, computed, onMounted, onUnmounted, type ComputedRef } from 'vue'

/**
 * Side-panel width matching Atlas / Atlas3 drawers: 85% of the viewport, capped
 * at 1400px and floored at 300px on desktop; full viewport width at ≤768px.
 */
export function useDrawerWidth(): ComputedRef<number> {
  const w = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
  const onResize = () => { w.value = window.innerWidth }
  onMounted(() => window.addEventListener('resize', onResize))
  onUnmounted(() => window.removeEventListener('resize', onResize))
  return computed(() => (w.value <= 768 ? w.value : Math.max(Math.min(w.value * 0.85, 1400), 300)))
}
