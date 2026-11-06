// Sessions remain in memory. Only a short-lived PKCE verifier survives a tab change.
export function transientStorage(persistent, now = Date.now) {
  const memory = new Map();
  const lifetime = 10 * 60 * 1000;
  const verifier = key => key.endsWith('-code-verifier');
  return {
    getItem(key) {
      if (!verifier(key)) return memory.get(key) ?? null;
      try {
        const item = JSON.parse(persistent.getItem(key) || 'null');
        if (!item || item.expires <= now() || typeof item.value !== 'string') {
          persistent.removeItem(key); return null;
        }
        return item.value;
      } catch { persistent.removeItem(key); return null; }
    },
    setItem(key,value) {
      if (verifier(key)) persistent.setItem(key,JSON.stringify({value,expires:now()+lifetime}));
      else memory.set(key,value);
    },
    removeItem(key) { memory.delete(key); if (verifier(key)) persistent.removeItem(key); }
  };
}
