// "Build your own itinerary": the traveler picks the city plan, then chooses hotels, flights and
// attractions themselves. We start from a valid skeleton (cheapest hotels and flights, NO attractions)
// that already follows every rule, and the normal editor does the rest.
import { enumerateCityPlans } from './cityplans.js';
import { buildPackagesForPlans } from './planner.js';

const key = (p) => p.map((x) => `${x.city}:${x.nights}`).join('|');
const label = (p) => p.map((x) => `${x.city} (${x.nights})`).join(' → ');

// every city plan that can be built for this request, with the price of its empty skeleton
export function builderPlans(req, catalog) {
  const { data_window: w } = catalog.rules;
  if (req.start_date < w.first_night || req.end_date > w.last_departure) return [];
  const plans = enumerateCityPlans(catalog.countryByName.get(req.country), req.nights, catalog.rules.min_nights_per_city, true);
  return buildPackagesForPlans(req, plans, catalog, { noAttractions: true })
    .filter((x) => x.result.ok)
    .map((x) => ({ plan: x.plan, label: label(x.plan), total_inr: x.result.pkg.total, result: x.result }))
    .sort((a, b) => a.total_inr - b.total_inr);
}

// the empty skeleton for the plan the traveler chose, or null if that plan is not valid
export function createSkeleton(req, wantedPlan, catalog) {
  const wanted = (wantedPlan ?? []).map((x) => ({ city: x.city, nights: Number(x.nights) }));
  return builderPlans(req, catalog).find((p) => key(p.plan) === key(wanted))?.result.pkg ?? null;
}
