// The planner builds a complete package for a request. The pieces it picks are chosen so that
// the validator (validator.js) accepts them; every finished package is checked by it again.
import { enumerateCityPlans } from './cityplans.js';
import { assignAttractions, visitStart } from './schedule.js';
import { assembleTrip, bestArrivalTransfer, bestDepartureTransfer } from './assemble.js';
import { addDays, dayNumber, nightsBetween, weekdayOf } from './time.js';
import { attractionPrice, flightPrice, hotelPrice, minRooms } from './pricing.js';

// ---------------------------------------------------------------------------
// Build ONE package for ONE city plan. Returns { ok:true, pkg } or { ok:false, reason }.
// ---------------------------------------------------------------------------
function buildForPlan(plan, ctx) {
  const { catalog, req, travelers, adults, children, country } = ctx;
  const fail = (reason) => ({ ok: false, reason });

  // stays: the city, its dates, and its nights
  const stays = [];
  let from = req.start_date;
  for (const p of plan) {
    const to = addDays(from, p.nights);
    stays.push({ city: p.city, from, to, nights: nightsBetween(from, to) });
    from = to;
  }
  const first = stays[0];
  const last = stays[stays.length - 1];

  // flights that can serve the first / last city
  if (flightsFor(ctx, first.city, 'arr').length === 0)
    return fail(`No flight from ${req.departure_airport} lands in ${req.country} on ${req.start_date} at an airport serving ${first.city} with ${travelers} free seats`);
  if (flightsFor(ctx, last.city, 'ret').length === 0)
    return fail(`No flight leaves from an airport serving ${last.city} to ${req.departure_airport} on ${req.end_date} with ${travelers} free seats`);

  // hotel choice per city (cheapest overall, counting the airport legs for the first and last city)
  const chosen = [];
  for (let i = 0; i < stays.length; i++) {
    const s = stays[i];
    const opts = hotelOptions(ctx, s);
    if (opts.length === 0)
      return fail(`No ${s.city} hotel has a room type for ${adults} adults + ${children} children free on every night ${s.from} to ${s.to}`);
    const isFirst = i === 0;
    const isLast = i === stays.length - 1;
    let best = null;
    for (const o of opts) {
      let cost = o.price;
      let arr = null;
      let dep = null;
      if (isFirst) { arr = arrivalBest(ctx, s.city, o.hotel.area); if (!arr) continue; cost += arr.cost; }
      if (isLast) { dep = departureBest(ctx, s.city, o.hotel.area); if (!dep) continue; cost += dep.cost; }
      const rated = ctx.mode === 'rated'; // best rated: most stars first, then cheapest
      const better = !best || (rated && o.hotel.stars !== best.o.hotel.stars ? o.hotel.stars > best.o.hotel.stars : cost < best.cost);
      if (better) best = { o, arr, dep, cost };
    }
    if (!best)
      return fail(`No valid airport flight + transfer combination for a ${s.city} hotel (service hours or time rules)`);
    chosen.push(best);
  }

  // attractions: one per full day. Every stay's first day is the arrival day or a city-change day.
  const visits = []; // { att, date, start, end }
  for (const s of ctx.noAttractions ? [] : stays) {
    const fullDays = s.nights.slice(1);
    const pool = catalog.attractionsByCity.get(s.city) ?? [];
    const eligible = (a, d) => visitStart(a) !== null && a.open_days.includes(weekdayOf(d)) && !(a.closed_dates ?? []).includes(d);
    // many city plans share the same city + days, so remember the answer
    const akey = `att|${s.city}|${fullDays.join(',')}`;
    if (!ctx.cache.has(akey)) ctx.cache.set(akey, assignAttractions(fullDays, pool, eligible, (a) => attractionPrice(a, adults, children)));
    const picks = ctx.cache.get(akey);
    if (picks === null)
      return fail(`${s.city} does not have enough different attractions open on its ${fullDays.length} full day(s) (${fullDays[0]} to ${fullDays[fullDays.length - 1]})`);
    picks.forEach((att, i) => {
      const start = visitStart(att);
      visits.push({ att, date: fullDays[i], start, end: start + att.visit_minutes });
    });
  }

  // ---------- hand the choices to assembleTrip, which builds every derived part and validates ----------
  const selection = {
    name: req.name,
    request: req,
    arrival_flight_id: chosen[0].arr.flight.flight_id,
    return_flight_id: chosen[chosen.length - 1].dep.flight.flight_id,
    stays: stays.map((s, i) => ({ city: s.city, from: s.from, to: s.to, hotel_id: chosen[i].o.hotel.hotel_id, room_id: chosen[i].o.room.room_id, k: chosen[i].o.k })),
    visits: visits.map((v) => ({ attraction_id: v.att.attraction_id, date: v.date, start: v.start })),
  };
  const built = assembleTrip(selection, catalog, { firstPackage: !ctx.noAttractions }); // safety gate: never return a package the validator rejects
  if (!built.ok) return fail(`internal: ${built.errors[0].rule} ${built.errors[0].message}`);

  return {
    ok: true,
    pkg: { trip: built.trip, selection, total: built.trip.total_inr, ...built.meta, cities: plan.map((p) => `${p.city} (${p.nights})`).join(' → ') },
  };
}

// ---------------------------------------------------------------------------
// Building blocks (cached per request)
// ---------------------------------------------------------------------------

// flights usable as the arrival ('arr') or return ('ret') flight for a city
function flightsFor(ctx, city, dir) {
  const key = `f|${dir}|${city}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  const { catalog, req, travelers, country } = ctx;
  const out = [];
  for (const ap of catalog.raw.airports) {
    if (ap.country !== country.code || !ap.serves_cities?.includes(city)) continue;
    const route = dir === 'arr' ? `${req.departure_airport}>${ap.code}` : `${ap.code}>${req.departure_airport}`;
    for (const f of catalog.flightsByRoute.get(route) ?? []) {
      const date = (dir === 'arr' ? f.arrival_local : f.departure_local).slice(0, 10);
      if (date === (dir === 'arr' ? req.start_date : req.end_date) && f.seats_left >= travelers) out.push(f);
    }
  }
  ctx.cache.set(key, out);
  return out;
}

// cheapest arrival flight + airport transfer for a hotel area (prefers a same-day pickup)
function arrivalBest(ctx, city, area) {
  const key = `a|${city}|${area}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  let best = null;
  for (const f of flightsFor(ctx, city, 'arr')) {
    const tr = bestArrivalTransfer(ctx.catalog, f, city, area, ctx.adults, ctx.children, ctx.req.start_date);
    if (!tr) continue;
    const cand = { flight: f, ...tr, cost: flightPrice(f, ctx.travelers) + tr.cost, sameDay: tr.pickup >= dayStart(ctx.req.start_date) && tr.pickup < dayStart(ctx.req.start_date) + 1440 };
    const better = !best || (cand.sameDay && !best.sameDay) || (cand.sameDay === best.sameDay && betterFlight(ctx, cand, best));
    if (better) best = cand;
  }
  ctx.cache.set(key, best);
  return best;
}

// cheapest return flight + hotel-to-airport transfer for a hotel area
function departureBest(ctx, city, area) {
  const key = `d|${city}|${area}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  let best = null;
  for (const f of flightsFor(ctx, city, 'ret')) {
    const tr = bestDepartureTransfer(ctx.catalog, f, city, area, ctx.adults, ctx.children, ctx.req.end_date);
    if (!tr) continue;
    const cand = { flight: f, ...tr, cost: flightPrice(f, ctx.travelers) + tr.cost };
    if (!best || betterFlight(ctx, cand, best)) best = cand;
  }
  ctx.cache.set(key, best);
  return best;
}

const dayStart = (date) => dayNumber(date) * 1440;

// cheapest by default; in "fast" mode the shortest flight wins first, then the price
function betterFlight(ctx, a, b) {
  const da = a.flight.duration_minutes;
  const db = b.flight.duration_minutes;
  if (ctx.mode === 'fast' && da !== db) return da < db;
  return a.cost < b.cost || (a.cost === b.cost && da < db);
}

// every hotel + room type + room count that fits the group and is free on every night
function hotelOptions(ctx, stay) {
  const key = `h|${stay.city}|${stay.from}|${stay.to}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  const { catalog, adults, children } = ctx;
  const out = [];
  for (const hotel of catalog.hotelsByCity.get(stay.city) ?? []) {
    for (const room of catalog.roomsByHotel.get(hotel.hotel_id) ?? []) {
      const k = minRooms(room, adults, children);
      if (!k) continue;
      const avail = catalog.availability.get(room.room_id);
      if (!stay.nights.every((n) => (avail?.get(n) ?? 0) >= k)) continue;
      out.push({ hotel, room, k, price: hotelPrice(room, k, stay.nights.length) });
    }
  }
  ctx.cache.set(key, out);
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// All packages we can build for this request (one per city plan), cheapest first.
// mode: 'cheap' (default), 'fast' (shortest flights) or 'rated' (most hotel stars)
function makeCtx(req, catalog, mode = 'cheap', noAttractions = false) {
  return {
    catalog, req, country: catalog.countryByName.get(req.country), cache: new Map(), mode, noAttractions,
    adults: req.adults, children: req.children, travelers: req.adults + req.children,
  };
}

// One package for a given city plan (used when the traveler picks another city plan, G3, or builds their own).
export function buildPackageForPlan(req, plan, catalog, opts = {}) {
  return buildForPlan(plan, makeCtx(req, catalog, opts.mode, !!opts.noAttractions));
}

// Build packages for several city plans at once, sharing one cache. Returns [{ plan, result }].
export function buildPackagesForPlans(req, plans, catalog, opts = {}) {
  const ctx = makeCtx(req, catalog, opts.mode, !!opts.noAttractions);
  return plans.map((plan) => ({ plan, result: buildForPlan(plan, ctx) }));
}

export function findPackages(req, catalog, mode = 'cheap') {
  const ctx = makeCtx(req, catalog, mode);
  const country = ctx.country;
  const { data_window: w } = catalog.rules;
  if (req.start_date < w.first_night || req.end_date > w.last_departure)
    return { packages: [], reasons: [`Flights and rooms only exist from ${w.first_night} to ${w.last_departure}. This trip runs ${req.start_date} to ${req.end_date}.`] };

  const packages = [];
  const reasons = new Map();
  for (const plan of enumerateCityPlans(country, req.nights, catalog.rules.min_nights_per_city)) {
    const r = buildForPlan(plan, ctx);
    if (r.ok) packages.push(r.pkg);
    else reasons.set(r.reason, (reasons.get(r.reason) ?? 0) + 1);
  }
  packages.sort((a, b) => a.total - b.total);
  const topReasons = [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  return { packages, reasons: topReasons };
}

const rupees = (n) => `₹${n.toLocaleString('en-IN')}`;

// G4: the three packages. Cheapest = lowest total. Fastest = least travel time (flight durations + transfers
// between cities). Best rated = highest average hotel stars per night. All three must fit the budget.
// If one package wins several of these it carries several labels; we then add the next cheapest
// different packages so the traveler still has up to three to choose from.
export function chooseOptions(req, catalog) {
  const all = [];
  const seen = new Set();
  for (const mode of ['cheap', 'fast', 'rated'])
    for (const p of findPackages(req, catalog, mode).packages) {
      const key = JSON.stringify(p.selection);
      if (!seen.has(key)) { seen.add(key); all.push(p); }
    }
  const ok = all.filter((p) => p.total <= req.budget_inr);
  if (ok.length === 0) return { options: [], cheapest: all.sort((a, b) => a.total - b.total)[0] ?? null };
  const best = (cmp) => [...ok].sort(cmp)[0];
  const winners = [
    ['Cheapest', best((a, b) => a.total - b.total)],
    ['Fastest', best((a, b) => a.travelMinutes - b.travelMinutes || a.total - b.total)],
    ['Best rated', best((a, b) => b.avgStars - a.avgStars || a.total - b.total)],
  ];
  const options = [];
  for (const [label, pkg] of winners) {
    const have = options.find((o) => o.pkg === pkg);
    if (have) have.labels.push(label);
    else options.push({ labels: [label], pkg });
  }
  for (const p of [...ok].sort((a, b) => a.total - b.total)) {
    if (options.length >= 3) break;
    if (!options.some((o) => o.pkg === p)) options.push({ labels: ['Another option'], pkg: p });
  }
  return { options, cheapest: options[0].pkg };
}

// Answer a request: packages to choose from, "over budget" with the cheapest total, or "no package" with the reason.
export function planTrip(req, catalog) {
  const { packages, reasons } = findPackages(req, catalog);

  if (packages.length === 0) {
    return {
      status: 'NO_PACKAGE',
      message: `No holiday package is possible for this request. ${reasons[0] ?? ''}`.trim(),
      reasons: reasons.slice(0, 5),
      suggestions: [],
    };
  }

  const cheapest = packages[0];
  if (cheapest.total > req.budget_inr) {
    const over = cheapest.total - req.budget_inr;
    return {
      status: 'OVER_BUDGET',
      message: `No package fits your budget of ${rupees(req.budget_inr)}. The cheapest valid package costs ${rupees(cheapest.total)}, which is ${rupees(over)} over.`,
      cheapest_total_inr: cheapest.total,
      budget_inr: req.budget_inr,
      over_by_inr: over,
      cheapest_trip: cheapest.trip,
      suggestions: budgetSuggestions(req, catalog, cheapest.total),
    };
  }

  const { options } = chooseOptions(req, catalog);
  return {
    status: 'OK',
    message: `We found ${options.length} holiday package${options.length > 1 ? 's' : ''} for you.`,
    // the cheapest, kept at the top level for simple clients
    trip: options[0].pkg.trip,
    cities: options[0].pkg.cities,
    total_inr: options[0].pkg.total,
    budget_inr: req.budget_inr,
    balance_inr: req.budget_inr - options[0].pkg.total,
    options: options.map(({ labels, pkg }) => ({
      labels,
      cities: pkg.cities,
      trip: pkg.trip,
      total_inr: pkg.total,
      budget_inr: req.budget_inr,
      balance_inr: req.budget_inr - pkg.total,
      meta: { travelMinutes: pkg.travelMinutes, avgStars: pkg.avgStars, labels, cities: pkg.cities },
    })),
  };
}

// M8 suggestions: raise the budget, or try a nearby variant that does fit.
function budgetSuggestions(req, catalog, cheapestTotal) {
  const out = [`Increase the budget to at least ${rupees(cheapestTotal)}.`];
  const variants = [];
  if (req.nights - 1 >= catalog.rules.min_nights) variants.push({ ...req, nights: req.nights - 1, label: `Stay ${req.nights - 1} nights instead of ${req.nights}` });
  for (const d of [-2, -1, 1, 2]) variants.push({ ...req, start_date: addDays(req.start_date, d), label: `Start on ${addDays(req.start_date, d)} instead of ${req.start_date}` });
  for (const v of variants) {
    const r = { ...v, end_date: addDays(v.start_date, v.nights) };
    const best = findPackages(r, catalog).packages[0];
    if (best && best.total <= req.budget_inr) out.push(`${v.label}: from ${rupees(best.total)}.`);
  }
  return out.slice(0, 4);
}
