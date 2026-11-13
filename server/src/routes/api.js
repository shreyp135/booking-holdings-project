import { Router } from 'express';
import { validateRequest } from '../engine/request.js';
import { planTrip } from '../engine/planner.js';        // <- new

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

  // M2/M8: build a package. Bad input -> 400 with a message per field.
  // Otherwise 200 with { status: 'OK' | 'OVER_BUDGET' | 'NO_PACKAGE', message, ... }.
  r.post('/plan', (req, res) => {
    const checked = validateRequest(req.body, catalog);
    if (!checked.ok) return res.status(400).json({ error: 'Invalid request', fields: checked.errors });
    res.json({ request: checked.value, ...planTrip(checked.value, catalog) });
  });

  return r;
}
