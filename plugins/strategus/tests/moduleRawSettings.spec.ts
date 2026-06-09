import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useStrategusStore } from '../src/store/useStrategusStore';

describe('moduleRawSettings', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('exposes an empty moduleRawSettings map and clears on reset', () => {
    const store = useStrategusStore();
    expect(store.moduleRawSettings).toEqual({});
    store.moduleRawSettings['CohortMethodModule'] = { foo: 1 };
    store.resetToDefaults();
    expect(store.moduleRawSettings).toEqual({});
  });
});
