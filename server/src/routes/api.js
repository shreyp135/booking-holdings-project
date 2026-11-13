import { Router } from 'express';
import { validateRequest } from '../engine/request.js';

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

  // M1: validate the request form. 200 with the cleaned request, or 400 with a message per field.
  r.post('/requests/validate', (req, res) => {
    const result = validateRequest(req.body, catalog);
    if (!result.ok) return res.status(400).json({ error: 'Invalid request', fields: result.errors });
    res.json({ ok: true, request: result.value });
  });

  return r;
}
