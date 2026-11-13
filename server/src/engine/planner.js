// The planner builds a complete package for a request. The pieces it picks are chosen so that
// the validator (validator.js) accepts them; every finished package is checked by it again.
import { randomUUID } from 'node:crypto';
import { enumerateCityPlans } from './cityplans.js';
import { assignAttractions, earliestPickupAfter, intercityDeparture, latestPickupBefore, visitStart } from './schedule.js';
import { absMin, addDays, dayNumber, fromAbs, makeDateTime, nightsBetween, weekdayOf } from './time.js';
import { attractionPrice, flightPrice, hotelPrice, minRooms, transferPrice, vehiclesNeeded } from './pricing.js';
import { validateTrip } from './validator.js';

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
      if (!best || cost < best.cost) best = { o, arr, dep, cost };
    }
    if (!best)
      return fail(`No valid airport flight + transfer combination for a ${s.city} hotel (service hours or time rules)`);
    chosen.push(best);
  }

  // transfers between cities
  const hops = [];
  for (let i = 0; i < stays.length - 1; i++) {
    const A = stays[i].city;
    const B = stays[i + 1].city;
    const day = stays[i].to;
    const link = country.links.find((l) => l.from_city === A && l.to_city === B);
    const ts = (link?.transfer_ids ?? []).map((id) => catalog.transferById.get(id)).filter(Boolean);
    if (ts.length === 0) return fail(`No transfer from ${A} to ${B}`);
    ts.sort((a, b) => transferPrice(a, adults, children) - transferPrice(b, adults, children) || a.duration_minutes - b.duration_minutes);
    hops.push({ t: ts[0], pickup: intercityDeparture(day, ts[0]), A, B, day });
  }

  // attractions: one per full day. Every stay's first day is the arrival day or a city-change day.
  const visits = []; // { att, date, start, end }
  for (const s of stays) {
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

  // ---------- assemble the trip in the shared export format ----------
  const items = [];
  const add = (o) => items.push({ item_id: `i${items.length + 1}`, status: 'PLANNED', room_id: null, booking: null, sources: [], warnings: [], ...o });
  const qty = (t) => (t.pricing === 'PER_VEHICLE' ? vehiclesNeeded(t, travelers) : travelers);

  const { arr } = chosen[0];
  const { dep } = chosen[chosen.length - 1];
  const af = arr.flight;
  const rf = dep.flight;
  add({ type: 'flight', name: `${af.airline} ${af.flight_number} ${af.from} to ${af.to}`, city: first.city, catalog_id: af.flight_id, start: af.departure_local.slice(0, 16), end: af.arrival_local.slice(0, 16), quantity: travelers, price_inr: flightPrice(af, travelers) });
  add({ type: 'transfer', name: arr.transfer.name, city: first.city, catalog_id: arr.transfer.transfer_id, start: fromAbs(arr.pickup), end: fromAbs(arr.pickup + arr.transfer.duration_minutes), quantity: qty(arr.transfer), price_inr: transferPrice(arr.transfer, adults, children) });
  stays.forEach((s, i) => {
    const { o } = chosen[i];
    add({ type: 'hotel', name: o.hotel.name, city: s.city, catalog_id: o.hotel.hotel_id, room_id: o.room.room_id, start: s.from, end: s.to, quantity: o.k, price_inr: o.price });
    if (i < hops.length) {
      const h = hops[i];
      add({ type: 'transfer', name: h.t.name, city: h.B, catalog_id: h.t.transfer_id, start: fromAbs(h.pickup), end: fromAbs(h.pickup + h.t.duration_minutes), quantity: qty(h.t), price_inr: transferPrice(h.t, adults, children) });
    }
  });
  for (const v of visits.sort((a, b) => a.date.localeCompare(b.date))) {
    add({ type: 'attraction', name: v.att.name, city: v.att.city, catalog_id: v.att.attraction_id, start: makeDateTime(v.date, v.start), end: makeDateTime(v.date, v.end), quantity: travelers, price_inr: attractionPrice(v.att, adults, children) });
  }
  add({ type: 'transfer', name: dep.transfer.name, city: last.city, catalog_id: dep.transfer.transfer_id, start: fromAbs(dep.pickup), end: fromAbs(dep.pickup + dep.transfer.duration_minutes), quantity: qty(dep.transfer), price_inr: transferPrice(dep.transfer, adults, children) });
  add({ type: 'flight', name: `${rf.airline} ${rf.flight_number} ${rf.from} to ${rf.to}`, city: req.departure_city, catalog_id: rf.flight_id, start: rf.departure_local.slice(0, 16), end: rf.arrival_local.slice(0, 16), quantity: travelers, price_inr: flightPrice(rf, travelers) });

  const total = items.reduce((s, i) => s + i.price_inr, 0);
  const trip = {
    trip_id: `trip-${randomUUID().slice(0, 8)}`,
    traveler: { name: req.name || 'Traveler', home_airport: req.departure_airport, adults, children, child_ages: req.child_ages },
    country: req.country,
    start_date: req.start_date,
    end_date: req.end_date,
    budget_inr: req.budget_inr,
    total_inr: total,
    items,
  };

  // safety gate: never return a package the validator rejects
  const check = validateTrip(trip, catalog, { firstPackage: true });
  if (!check.valid) return fail(`internal: ${check.errors[0].rule} ${check.errors[0].message}`);

  const travelMinutes = af.duration_minutes + rf.duration_minutes + hops.reduce((s, h) => s + h.t.duration_minutes, 0);
  const avgStars = stays.reduce((s, st, i) => s + chosen[i].o.hotel.stars * st.nights.length, 0) / (dayNumber(req.end_date) - dayNumber(req.start_date));
  return { ok: true, pkg: { trip, total, travelMinutes, avgStars, cities: plan.map((p) => `${p.city} (${p.nights})`).join(' → ') } };
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

const transfersFor = (ctx, airport, city, area) =>
  (ctx.catalog.airportTransfers.get(`${airport}|${city}`) ?? []).filter((t) => t.area === null || t.area === area);

// cheapest arrival flight + airport transfer for a hotel area
function arrivalBest(ctx, city, area) {
  const key = `a|${city}|${area}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  // Prefer a pickup on the arrival day itself. A pickup the next morning is still legal,
  // so it stays as a fallback when no same-day option exists.
  const startDay = dayNumber(ctx.req.start_date);
  let sameDay = null;
  let anyDay = null;
  const better = (cand, cur) => !cur || cand.cost < cur.cost || (cand.cost === cur.cost && cand.flight.duration_minutes < cur.flight.duration_minutes);
  for (const f of flightsFor(ctx, city, 'arr')) {
    const landing = absMin(f.arrival_local);
    for (const t of transfersFor(ctx, f.to, city, area)) {
      const pickup = earliestPickupAfter(landing + 60, t);
      if (pickup === null) continue;
      const cand = { flight: f, transfer: t, pickup, cost: flightPrice(f, ctx.travelers) + transferPrice(t, ctx.adults, ctx.children) };
      if (better(cand, anyDay)) anyDay = cand;
      if (Math.floor(pickup / 1440) === startDay && better(cand, sameDay)) sameDay = cand;
    }
  }
  const best = sameDay ?? anyDay;
  ctx.cache.set(key, best);
  return best;
}

// cheapest return flight + hotel-to-airport transfer for a hotel area
function departureBest(ctx, city, area) {
  const key = `d|${city}|${area}`;
  if (ctx.cache.has(key)) return ctx.cache.get(key);
  let best = null;
  const endDay = dayNumber(ctx.req.end_date);
  for (const f of flightsFor(ctx, city, 'ret')) {
    const departure = absMin(f.departure_local);
    for (const t of transfersFor(ctx, f.from, city, area)) {
      const pickup = latestPickupBefore(departure - 180 - t.duration_minutes, t);
      if (pickup === null || Math.floor(pickup / 1440) < endDay) continue; // leave the hotel on the last day
      const cost = flightPrice(f, ctx.travelers) + transferPrice(t, ctx.adults, ctx.children);
      if (!best || cost < best.cost || (cost === best.cost && f.duration_minutes < best.flight.duration_minutes)) best = { flight: f, transfer: t, pickup, cost };
    }
  }
  ctx.cache.set(key, best);
  return best;
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
export function findPackages(req, catalog) {
  const country = catalog.countryByName.get(req.country);
  const ctx = {
    catalog, req, country, cache: new Map(),
    adults: req.adults, children: req.children, travelers: req.adults + req.children,
  };
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

// Answer a request: a package, "over budget" with the cheapest total, or "no package" with the reason.
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

  return {
    status: 'OK',
    message: `Your holiday package is ready: ${cheapest.cities}.`,
    trip: cheapest.trip,
    cities: cheapest.cities,
    total_inr: cheapest.total,
    budget_inr: req.budget_inr,
    balance_inr: req.budget_inr - cheapest.total,
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
