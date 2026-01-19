/**
 * Generic cache helper with optional eviction support.
 * Expects storage adapter methods: get, set, keys, del.
 */
function createCache({ get, set, keys, del, logger, ttlMs, now }) {
  const nowFn = typeof now === "function" ? now : Date.now; // this allows for mocking the time function
  let evictionInFlight = false;

  async function getItem(key) {
    if (!get) return null;
    try {
      const item = await get(key);
      return item && Object.prototype.hasOwnProperty.call(item, "value")
        ? item
        : null;
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

  return { getItem, setItem, evictOld };
}
