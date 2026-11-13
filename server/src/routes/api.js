import { Router } from 'express';

export function buildRouter(catalog) {
  const r = Router();

  r.get('/health', (_req, res) => res.json({ ok: true }));

  // Everything the request form (M1) needs.
  r.get('/destinations', (_req, res) => {
    res.json({
      departureCities: catalog.departureCities,
      countries: catalog.countries.map((c) => ({
        code: c.code,
        name: c.name,
        cities: c.cities.map((x) => x.name),
      })),
      rules: catalog.rules,
    });
  });

  return r;
}
