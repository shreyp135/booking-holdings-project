import { useEffect, useState } from 'react';

// file -> { used_for, author, license } for every photo, loaded once from /api/credits
let cache = null;
let pending = null;
export function useCredits() {
  const [map, setMap] = useState(cache);
  useEffect(() => {
    if (cache) return;
    pending ??= fetch('/api/credits').then((r) => r.json()).then((d) => (cache = Object.fromEntries(d.credits.map((c) => [c.file, c])))).catch(() => (cache = {}));
    pending.then(setMap);
  }, []);
  return map ?? {};
}
export const creditLine = (c) => (c ? `Photo: ${c.used_for} · ${c.author} · ${c.license.text}` : '');
