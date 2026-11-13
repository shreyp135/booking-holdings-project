// Turns a SELECTION (the few choices that define a package) into a full trip with every
// derived part (transfers, times, quantities, prices) worked out. Both the planner and the
// editor use this, so a package that was edited is built exactly like a planned one.
//
// selection = {
//   trip_id?, name?, request: { departure_airport, departure_city, country, start_date, end_date,
//                               adults, children, child_ages, budget_inr },
//   arrival_flight_id, return_flight_id,
//   stays:  [{ city, from, to, hotel_id, room_id, k }],      // k = number of rooms
//   visits: [{ attraction_id, date, start }]                  // start = minutes since midnight
// }
import { randomUUID } from 'node:crypto';
import { earliestPickupAfter, intercityDeparture, latestPickupBefore } from './schedule.js';
import { absMin, dayNumber, fromAbs, makeDateTime, nightsBetween } from './time.js';
import { attractionPrice, flightPrice, hotelPrice, transferPrice, vehiclesNeeded } from './pricing.js';
import { validateTrip } from './validator.js';

const areaMatches = (t, area) => t.area === null || t.area === area;
const cheaper = (a, b) => !b || a.cost < b.cost || (a.cost === b.cost && a.transfer.duration_minutes < b.transfer.duration_minutes);

// Best airport -> hotel transfer for this flight: prefers a pickup on the arrival day, then cheapest.
export function bestArrivalTransfer(catalog, flight, city, area, adults, children, startDate) {
  const landing = absMin(flight.arrival_local);
  const startDay = dayNumber(startDate);
  let sameDay = null;
  let any = null;
  for (const t of catalog.airportTransfers.get(`${flight.to}|${city}`) ?? []) {
    if (!areaMatches(t, area)) continue;
    const pickup = earliestPickupAfter(landing + 60, t);
    if (pickup === null) continue;
    const cand = { transfer: t, pickup, cost: transferPrice(t, adults, children) };
    if (cheaper(cand, any)) any = cand;
    if (Math.floor(pickup / 1440) === startDay && cheaper(cand, sameDay)) sameDay = cand;
  }
  return sameDay ?? any;
}

// Best hotel -> airport transfer for this flight: leaves on the last day, 180 min before departure.
export function bestDepartureTransfer(catalog, flight, city, area, adults, children, endDate) {
  const departure = absMin(flight.departure_local);
  const endDay = dayNumber(endDate);
  let best = null;
  for (const t of catalog.airportTransfers.get(`${flight.from}|${city}`) ?? []) {
    if (!areaMatches(t, area)) continue;
    const pickup = latestPickupBefore(departure - 180 - t.duration_minutes, t);
    if (pickup === null || Math.floor(pickup / 1440) < endDay) continue;
    const cand = { transfer: t, pickup, cost: transferPrice(t, adults, children) };
    if (cheaper(cand, best)) best = cand;
  }
  return best;
}

export function assembleTrip(sel, catalog, opts = {}) {
  const fail = (...errors) => ({ ok: false, trip: null, errors: errors.map((message) => ({ rule: 'ASSEMBLE', message, item_id: null })) });
  const req = sel.request;
  const { adults, children } = req;
  const travelers = adults + children;

  const af = catalog.flightById.get(sel.arrival_flight_id);
  const rf = catalog.flightById.get(sel.return_flight_id);
  if (!af || !rf) return fail('Unknown flight');
  if (!sel.stays.length) return fail('No hotel in the package');

  const stays = [];
  for (const s of sel.stays) {
    const hotel = catalog.hotelById.get(s.hotel_id);
    const room = catalog.roomById.get(s.room_id);
    if (!hotel || !room) return fail('Unknown hotel or room');
    stays.push({ ...s, hotel, room, nights: nightsBetween(s.from, s.to) });
  }
  const first = stays[0];
  const last = stays[stays.length - 1];

  const arr = bestArrivalTransfer(catalog, af, first.city, first.hotel.area, adults, children, req.start_date);
  if (!arr) return fail(`No airport transfer from ${af.to} to ${first.hotel.name} (${first.city}) runs when this flight lands`);
  const dep = bestDepartureTransfer(catalog, rf, last.city, last.hotel.area, adults, children, req.end_date);
  if (!dep) return fail(`No airport transfer from ${last.hotel.name} (${last.city}) to ${rf.from} fits this return flight`);

  const country = catalog.countryByName.get(req.country);
  const hops = [];
  for (let i = 0; i < stays.length - 1; i++) {
    const A = stays[i].city;
    const B = stays[i + 1].city;
    const link = country.links.find((l) => l.from_city === A && l.to_city === B);
    const ts = (link?.transfer_ids ?? []).map((id) => catalog.transferById.get(id)).filter(Boolean);
    if (!ts.length) return fail(`No transfer from ${A} to ${B}`);
    ts.sort((a, b) => transferPrice(a, adults, children) - transferPrice(b, adults, children) || a.duration_minutes - b.duration_minutes);
    hops.push({ t: ts[0], pickup: intercityDeparture(stays[i].to, ts[0]), B });
  }

  // ---------- items ----------
  const items = [];
  const add = (o) => items.push({ item_id: `i${items.length + 1}`, status: 'PLANNED', room_id: null, booking: null, sources: [], warnings: [], ...o });
  const qty = (t) => (t.pricing === 'PER_VEHICLE' ? vehiclesNeeded(t, travelers) : travelers);
  const transferItem = (t, pickup, city) => ({
    type: 'transfer', name: t.name, city, catalog_id: t.transfer_id,
    start: fromAbs(pickup), end: fromAbs(pickup + t.duration_minutes),
    quantity: qty(t), price_inr: transferPrice(t, adults, children),
  });

  add({ type: 'flight', name: `${af.airline} ${af.flight_number} ${af.from} to ${af.to}`, city: first.city, catalog_id: af.flight_id, start: af.departure_local.slice(0, 16), end: af.arrival_local.slice(0, 16), quantity: travelers, price_inr: flightPrice(af, travelers) });
  add(transferItem(arr.transfer, arr.pickup, first.city));
  stays.forEach((s, i) => {
    add({ type: 'hotel', name: s.hotel.name, city: s.city, catalog_id: s.hotel.hotel_id, room_id: s.room.room_id, start: s.from, end: s.to, quantity: s.k, price_inr: hotelPrice(s.room, s.k, s.nights.length) });
    if (i < hops.length) add(transferItem(hops[i].t, hops[i].pickup, hops[i].B));
  });
  const visits = [...sel.visits].sort((a, b) => a.date.localeCompare(b.date) || a.start - b.start);
  for (const v of visits) {
    const att = catalog.attractionById.get(v.attraction_id);
    if (!att) return fail(`Unknown attraction ${v.attraction_id}`);
    add({ type: 'attraction', name: att.name, city: att.city, catalog_id: att.attraction_id, start: makeDateTime(v.date, v.start), end: makeDateTime(v.date, v.start + att.visit_minutes), quantity: travelers, price_inr: attractionPrice(att, adults, children) });
  }
  add(transferItem(dep.transfer, dep.pickup, last.city));
  add({ type: 'flight', name: `${rf.airline} ${rf.flight_number} ${rf.from} to ${rf.to}`, city: req.departure_city, catalog_id: rf.flight_id, start: rf.departure_local.slice(0, 16), end: rf.arrival_local.slice(0, 16), quantity: travelers, price_inr: flightPrice(rf, travelers) });

  const trip = {
    trip_id: sel.trip_id ?? `trip-${randomUUID().slice(0, 8)}`,
    traveler: { name: sel.name || 'Traveler', home_airport: req.departure_airport, adults, children, child_ages: req.child_ages },
    country: req.country,
    start_date: req.start_date,
    end_date: req.end_date,
    budget_inr: req.budget_inr,
    total_inr: items.reduce((s, i) => s + i.price_inr, 0),
    items,
  };

  const check = validateTrip(trip, catalog, { firstPackage: !!opts.firstPackage });
  const nights = dayNumber(req.end_date) - dayNumber(req.start_date);
  const meta = {
    travelMinutes: af.duration_minutes + rf.duration_minutes + hops.reduce((s, h) => s + h.t.duration_minutes, 0),
    avgStars: stays.reduce((s, st) => s + st.hotel.stars * st.nights.length, 0) / nights,
  };
  return { ok: check.valid, trip, errors: check.errors, meta };
}
