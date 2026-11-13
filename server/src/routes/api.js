import { Router } from 'express';
import { validateRequest } from '../engine/request.js';
import { planTrip } from '../engine/planner.js';
import { applyChange, listOptions, tripNotes } from '../engine/editor.js';
import { confirmPackage, isReference } from '../engine/booking.js';
import { builderPlans, createSkeleton } from '../engine/builder.js';
import { mediaFor } from '../engine/media.js';
import { loadCredits } from '../engine/credits.js';

export function buildRouter(catalog, store) {
  const r = Router();
  const credits = loadCredits();
  const prefs = (pkg) => ({ rooms: pkg.request?.rooms ?? null }); // what the traveler asked for besides the trip itself

  // what the traveler needs to see about a stored package
  const view = (pkg) => ({
    trip: pkg.trip,
    status: pkg.status,
    reference: pkg.reference ?? null,
    meta: pkg.meta ?? null,
    media: mediaFor(pkg.trip, catalog),
    total_inr: pkg.trip.total_inr,
    budget_inr: pkg.trip.budget_inr,
    balance_inr: pkg.trip.budget_inr - pkg.trip.total_inr,
    notes: tripNotes(pkg.trip, catalog),
  });

  // wrap async handlers so a database error becomes a clean 503 instead of a hanging request
  const safe = (fn) => async (req, res) => {
    try { await fn(req, res); }
    catch (e) {
      console.error('[api]', req.method, req.path, e.stack || e.message);
      const db = /mongo|buffering|ECONN|ENOTFOUND|server selection/i.test(`${e.name} ${e.message}`);
      res.status(db ? 503 : 500).json({ error: db ? 'The database is not available right now. Please try again.' : `Server error: ${e.message}` });
    }
  };
  const load = async (req, res) => {
    const pkg = await store.getPackage(req.params.id);
    if (!pkg) res.status(404).json({ error: 'Package not found' });
    return pkg;
  };

  r.get('/health', (_req, res) => res.json({ ok: true }));

  // Photo credits (licence terms of the images, shown in the app)
  r.get('/credits', (_req, res) => res.json({ credits }));

  // Everything the request form (M1) needs.
  r.get('/destinations', (_req, res) => {
    res.json({
      departureCities: catalog.departureCities,
      countries: catalog.countries.map((c) => ({ code: c.code, name: c.name, cities: c.cities.map((x) => x.name) })),
      rules: catalog.rules,
    });
  });

  // M1: validate the request form on its own.
  r.post('/requests/validate', (req, res) => {
    const result = validateRequest(req.body, catalog);
    if (!result.ok) return res.status(400).json({ error: 'Invalid request', fields: result.errors });
    res.json({ ok: true, request: result.value });
  });

  // M2/M8: build a package and save it. Bad input -> 400 with a message per field.
  // Otherwise 200 with { status: 'OK' | 'OVER_BUDGET' | 'NO_PACKAGE', message, ... }.
  r.post('/plan', safe(async (req, res) => {
    const checked = validateRequest(req.body, catalog);
    if (!checked.ok) return res.status(400).json({ error: 'Invalid request', fields: checked.errors });
    const result = planTrip(checked.value, catalog);
    if (result.status === 'OK') {
      // every option is saved as its own package, so each one can be customized and confirmed on its own
      for (const o of result.options) {
        await store.savePackage({ trip_id: o.trip.trip_id, request: checked.value, trip: o.trip, status: 'PLANNED', reference: null, meta: o.meta });
        o.notes = tripNotes(o.trip, catalog);
        o.media = mediaFor(o.trip, catalog);
      }
      result.notes = result.options[0].notes;
    }
    res.json({ request: checked.value, ...result });
  }));

  // Build your own itinerary: the city plans the traveler can start from (with the price of the empty skeleton)...
  r.post('/builder/plans', safe(async (req, res) => {
    const checked = validateRequest(req.body, catalog);
    if (!checked.ok) return res.status(400).json({ error: 'Invalid request', fields: checked.errors });
    const plans = builderPlans(checked.value, catalog).map(({ plan, label, total_inr }) => ({ plan, label, total_inr }));
    res.json({ request: checked.value, plans });
  }));

  // ...and creating the empty itinerary for the chosen plan. The traveler then adds hotels, flights and attractions.
  r.post('/builder/create', safe(async (req, res) => {
    const checked = validateRequest(req.body, catalog);
    if (!checked.ok) return res.status(400).json({ error: 'Invalid request', fields: checked.errors });
    const pkg = createSkeleton(checked.value, req.body.plan, catalog);
    if (!pkg) return res.status(422).json({ error: 'That city plan is not possible for this request' });
    const saved = { trip_id: pkg.trip.trip_id, request: checked.value, trip: pkg.trip, status: 'PLANNED', reference: null, meta: { labels: ['Build your own'], travelMinutes: pkg.travelMinutes, avgStars: pkg.avgStars, cities: pkg.cities } };
    await store.savePackage(saved);
    res.json(view(saved));
  }));

  // Open a saved package again (page refresh).
  r.get('/packages/:id', safe(async (req, res) => {
    const pkg = await load(req, res);
    if (pkg) res.json(view(pkg));
  }));

  // M5: download the package as JSON (shared trip format).
  r.get('/packages/:id/export', safe(async (req, res) => {
    const pkg = await load(req, res);
    if (!pkg) return;
    res.setHeader('Content-Disposition', `attachment; filename="${pkg.trip.trip_id}.json"`);
    res.json(pkg.trip);
  }));

  // What can be changed, with the real price difference of each choice.
  r.get('/packages/:id/options', safe(async (req, res) => {
    const pkg = await load(req, res);
    if (pkg) res.json(listOptions(pkg.trip, catalog, prefs(pkg)));
  }));

  // M6: change the package. Accepted -> saved and returned. Refused -> 422 with the reasons, nothing changes.
  r.post('/packages/:id/changes', safe(async (req, res) => {
    const pkg = await load(req, res);
    if (!pkg) return;
    if (pkg.status === 'BOOKED') return res.status(409).json({ ok: false, reasons: ['This package is already confirmed and cannot be changed.'] });
    const result = applyChange(pkg.trip, req.body, catalog, prefs(pkg));
    if (!result.ok) return res.status(422).json(result);
    const next = { ...pkg, trip: result.trip, meta: { ...pkg.meta, travelMinutes: result.meta.travelMinutes, avgStars: result.meta.avgStars } };
    await store.savePackage(next);
    res.json({ ok: true, delta_inr: result.delta_inr, change_notes: result.notes, ...view(next) });
  }));

  // M7: confirm -> reservation number.
  r.post('/packages/:id/confirm', safe(async (req, res) => {
    const pkg = await load(req, res);
    if (!pkg) return;
    const result = await confirmPackage(pkg, catalog, store);
    if (!result.ok) return res.status(result.status).json({ error: result.error });
    res.json({ reference: result.reference, ...view({ ...pkg, trip: result.trip, status: 'BOOKED', reference: result.reference }) });
  }));

  // M7: open a reservation by its number. A wrong number is "not found".
  r.get('/reservations/:reference', safe(async (req, res) => {
    const found = isReference(req.params.reference) ? await store.getReservation(req.params.reference) : null;
    if (!found) return res.status(404).json({ error: 'Reservation not found' });
    res.json(view({ trip: found.trip, status: 'BOOKED', reference: found.reference }));
  }));

  r.get('/reservations/:reference/export', safe(async (req, res) => {
    const found = isReference(req.params.reference) ? await store.getReservation(req.params.reference) : null;
    if (!found) return res.status(404).json({ error: 'Reservation not found' });
    res.setHeader('Content-Disposition', `attachment; filename="${found.reference}.json"`);
    res.json(found.trip);
  }));

  return r;
}
