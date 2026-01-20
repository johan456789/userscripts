/**
 * Generic cache helper with optional eviction support.
 * Expects storage adapter methods: get, set, keys, del.
 */
function createCache({ get, set, keys, del, logger, ttlMs, now }) {
  const nowFn = typeof now === "function" ? now : Date.now;
  let evictionInFlight = false;
  let evictionTimeoutId = null;
  let evictionIntervalId = null;

  async function getItem(key) {
    if (!get) return null;
    try {
      const item = await get(key);
      if (!item || !Object.prototype.hasOwnProperty.call(item, "value")) {
        return null;
      }
      if (ttlMs && del && item.creationDate) {
        const cutoff = nowFn() - ttlMs;
        if (item.creationDate < cutoff) {
          await del(key);
          return null;
        }
      }
      return item;
    } catch (err) {
      logger?.warn?.("Cache get failed", err);
      return null;
    }
  }

  async function setItem(key, value) {
    if (!set) return;
    try {
      const item = { value, creationDate: nowFn() };
      await set(key, item);
    } catch (err) {
      logger?.warn?.("Cache set failed", err);
    }
  }

  async function evictOld() {
    if (!keys || !get || !del || evictionInFlight || !ttlMs) return;
    evictionInFlight = true;
    try {
      const allKeys = await keys();
      if (!allKeys?.length) return;
      const cutoff = nowFn() - ttlMs;
      let evicted = 0;

      for (const key of allKeys) {
        const item = await get(key);
        if (item?.creationDate && item.creationDate < cutoff) {
          await del(key);
          evicted += 1;
        }
      }

      if (evicted > 0) {
        logger?.(`Evicted ${evicted} cached entries`);
      }
    } catch (err) {
      logger?.warn?.("Cache eviction failed", err);
    } finally {
      evictionInFlight = false;
    }
  }

  function startEviction({ initialDelayMs = 1500, intervalMs = 0 } = {}) {
    if (!ttlMs) return null;
    if (evictionTimeoutId) clearTimeout(evictionTimeoutId);
    if (evictionIntervalId) clearInterval(evictionIntervalId);
    if (initialDelayMs >= 0) {
      evictionTimeoutId = setTimeout(() => {
        void evictOld();
      }, initialDelayMs);
    }
    if (intervalMs > 0) {
      evictionIntervalId = setInterval(() => {
        void evictOld();
      }, intervalMs);
    }
    return () => {
      if (evictionTimeoutId) clearTimeout(evictionTimeoutId);
      if (evictionIntervalId) clearInterval(evictionIntervalId);
      evictionTimeoutId = null;
      evictionIntervalId = null;
    };
  }

  return { getItem, setItem, evictOld, startEviction };
}
