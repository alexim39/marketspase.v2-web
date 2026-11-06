/**
 * Capture-once singleton accessor for code that runs outside any injection
 * context — functional HTTP interceptors fire per request, including requests
 * initiated from click handlers, timers and subscription callbacks, where
 * `inject()` throws NG0203. The first in-context call captures the root
 * instance; later context-less calls reuse it. Returns null until captured.
 */
export function cachedSingleton<T>(get: () => T): () => T | null {
  let instance: T | null = null;
  return () => {
    if (instance === null) {
      try {
        instance = get();
      } catch {
        return null;
      }
    }
    return instance;
  };
}
