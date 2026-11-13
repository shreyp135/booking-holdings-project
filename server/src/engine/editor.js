// Editing a package (M6). Every change works the same way:
//   1. turn the trip back into a SELECTION (flights, hotels, attractions)
//   2. change that selection
//   3. rebuild the WHOLE package with assembleTrip (transfers, times, prices are re-derived)
//   4. the validator checks every rule again -> accept, or refuse with the reasons
import { assembleTrip } from './assemble.js';
import { minRooms } from './pricing.js';
import { visitStart } from './schedule.js';
import { addDays, nightsBetween, splitDateTime, toMin } from './time.js';

// ---------- trip <-> selection ----------
export function selectionFromTrip(trip, catalog) {
  const home = trip.traveler.home_airport;
  const items = (t) => trip.items.filter((i) => i.type === t);
  const sel = {
    trip_id: trip.trip_id,
    name: trip.traveler.name,
    request: {
      departure_airport: home,
      departure_city: catalog.departureCities.find((c) => c.airport === home)?.city ?? home,
      country: trip.country,
      start_date: trip.start_date,
      end_date: trip.end_date,
      adults: trip.traveler.adults,
      children: trip.traveler.children,
      child_ages: trip.traveler.child_ages,
      budget_inr: trip.budget_inr,
    },
    arrival_flight_id: null,
    return_flight_id: null,
    stays: items('hotel')
      .sort((a, b) => a.start.localeCompare(b.start))
      .map((h) => ({ city: h.city, from: h.start, to: h.end, hotel_id: h.catalog_id, room_id: h.room_id, k: h.quantity })),
    visits: items('attraction').map((a) => {
      const { date, min } = splitDateTime(a.start);
      return { attraction_id: a.catalog_id, date, start: min };
    }),
  };
  for (const f of items('flight')) {
    const flight = catalog.flightById.get(f.catalog_id);
    if (!flight) continue;
    if (flight.from === home) sel.arrival_flight_id = flight.flight_id;
    else sel.return_flight_id = flight.flight_id;
  }
  return sel;
}

// ---------- notes (shown to the traveler; they are not rule violations) ----------
export function tripNotes(trip, catalog) {
  const notes = [];
  const stays = trip.items.filter((i) => i.type === 'hotel').sort((a, b) => a.start.localeCompare(b.start));
  const airport = trip.items
    .filter((i) => i.type === 'transfer' && catalog.transferById.get(i.catalog_id)?.airport)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (stays.length && airport.length === 2) {
    const firstHotel = catalog.hotelById.get(stays[0].catalog_id);
    const lastHotel = catalog.hotelById.get(stays[stays.length - 1].catalog_id);
    const reach = splitDateTime(airport[0].end).min;
    if (firstHotel && reach < toMin(firstHotel.check_in_from))
      notes.push(`You reach ${firstHotel.name} at ${airport[0].end.slice(11, 16)}, before check-in opens at ${firstHotel.check_in_from}. Ask for early check-in or luggage storage.`);
    const leave = splitDateTime(airport[1].start).min;
    if (lastHotel && leave > toMin(lastHotel.check_out_until))
      notes.push(`You leave ${lastHotel.name} at ${airport[1].start.slice(11, 16)}, after check-out time ${lastHotel.check_out_until}. Ask for late check-out.`);
  }
  return notes;
}

const airportTransfers = (trip, catalog) =>
  trip.items
    .filter((i) => i.type === 'transfer' && catalog.transferById.get(i.catalog_id)?.airport)
    .sort((a, b) => a.start.localeCompare(b.start));

// what the rebuild changed on its own (airport transfers are re-chosen after a flight or hotel change)
function changeNotes(before, after, catalog) {
  const notes = [];
  const b = airportTransfers(before, catalog);
  const a = airportTransfers(after, catalog);
  const label = ['Arrival airport transfer', 'Departure airport transfer'];
  for (let i = 0; i < 2; i++) {
    if (!a[i] || !b[i]) continue;
    if (a[i].catalog_id !== b[i].catalog_id || a[i].start !== b[i].start)
      notes.push(`${label[i]} updated: ${a[i].name} at ${a[i].start.slice(11, 16)} on ${a[i].start.slice(0, 10)} (was ${b[i].name} at ${b[i].start.slice(11, 16)}).`);
  }
  return notes;
}

// ---------- the changes ----------
const refuse = (...reasons) => ({ ok: false, reasons });

// cheapest room of a hotel that fits the group and is free every night (or null + a reason)
function pickRoom(hotel, stay, sel, catalog, roomId) {
  const { adults, children } = sel.request;
  const nights = nightsBetween(stay.from, stay.to);
  let lastReason = `${hotel.name} has no room type`;
  const rooms = (catalog.roomsByHotel.get(hotel.hotel_id) ?? []).filter((r) => !roomId || r.room_id === roomId);
  if (roomId && rooms.length === 0) return { reason: 'That room type does not belong to this hotel' };
  let best = null;
  for (const room of rooms) {
    const k = minRooms(room, adults, children);
    if (!k) { lastReason = `${room.name} cannot fit ${adults} adults + ${children} children`; continue; }
    const avail = catalog.availability.get(room.room_id);
    const short = nights.find((n) => (avail?.get(n) ?? 0) < k);
    if (short) { lastReason = `${hotel.name} ${room.name}: only ${avail?.get(short) ?? 0} room(s) left on ${short}, need ${k}`; continue; }
    const total = room.price_per_night.amount * k; // compare the TOTAL: a cheaper room may need 2 rooms
    if (!best || total < best.total) best = { room, k, total };
  }
  if (best) return { room: best.room, k: best.k };
  return { reason: lastReason };
}

// first start time (and date) where an attraction can be added without breaking a rule
function findVisit(sel, att, catalog, { date, start } = {}) {
  const dates = date ? [date] : [];
  if (!date) for (let d = sel.request.start_date; d < sel.request.end_date; d = addDays(d, 1)) dates.push(d);
  const open = toMin(att.open_from);
  const latest = toMin(att.open_until) - att.visit_minutes;
  const starts = start !== undefined && start !== null ? [start] : [visitStart(att), ...range(open, latest, 30)].filter((s) => s !== null && s >= open && s <= latest);
  let reasons = null;
  for (const d of dates) {
    if (!sel.stays.some((s) => s.city === att.city && s.from <= d && d < s.to)) continue; // not in that city that night
    for (const s of starts) {
      const trial = { ...sel, visits: [...sel.visits, { attraction_id: att.attraction_id, date: d, start: s }] };
      const built = assembleTrip(trial, catalog);
      if (built.ok) return { visit: { attraction_id: att.attraction_id, date: d, start: s }, built };
      reasons ??= built.errors.map((e) => e.message);
    }
  }
  return { reasons: reasons ?? [`${att.name} (${att.city}) cannot be added: you are not in ${att.city} on any day it could fit`] };
}
const range = (from, to, step) => { const out = []; for (let x = from; x <= to; x += step) out.push(x); return out; };

/**
 * @param change one of
 *   { type: 'SET_HOTEL', city, hotel_id, room_id? }
 *   { type: 'SET_FLIGHT', direction: 'arrival' | 'return', flight_id }
 *   { type: 'ADD_ATTRACTION', attraction_id, date?, start? }
 *   { type: 'REMOVE_ATTRACTION', attraction_id }
 * @returns { ok: true, trip, delta_inr, notes } or { ok: false, reasons: [...] }
 */
export function applyChange(trip, change, catalog) {
  const sel = selectionFromTrip(trip, catalog);
  let built = null;

  switch (change?.type) {
    case 'SET_HOTEL': {
      const stay = sel.stays.find((s) => s.city === change.city);
      const hotel = catalog.hotelById.get(change.hotel_id);
      if (!stay) return refuse(`Your trip has no stay in ${change.city}`);
      if (!hotel || hotel.city !== change.city) return refuse(`That hotel is not in ${change.city}`);
      const picked = pickRoom(hotel, stay, sel, catalog, change.room_id);
      if (!picked.room) return refuse(picked.reason);
      Object.assign(stay, { hotel_id: hotel.hotel_id, room_id: picked.room.room_id, k: picked.k });
      break;
    }
    case 'SET_FLIGHT': {
      const flight = catalog.flightById.get(change.flight_id);
      if (!flight) return refuse('Unknown flight');
      const home = sel.request.departure_airport;
      if (change.direction === 'arrival') {
        if (flight.from !== home) return refuse(`The arrival flight must leave from ${home}`);
        sel.arrival_flight_id = flight.flight_id;
      } else if (change.direction === 'return') {
        if (flight.to !== home) return refuse(`The return flight must land at ${home}`);
        sel.return_flight_id = flight.flight_id;
      } else return refuse('direction must be "arrival" or "return"');
      break;
    }
    case 'ADD_ATTRACTION': {
      const att = catalog.attractionById.get(change.attraction_id);
      if (!att) return refuse('Unknown attraction');
      if (sel.visits.some((v) => v.attraction_id === att.attraction_id)) return refuse(`${att.name} is already in your package`);
      const found = findVisit(sel, att, catalog, change);
      if (!found.visit) return refuse(...found.reasons);
      sel.visits.push(found.visit);
      break;
    }
    case 'REMOVE_ATTRACTION': {
      const before = sel.visits.length;
      sel.visits = sel.visits.filter((v) => v.attraction_id !== change.attraction_id);
      if (sel.visits.length === before) return refuse('That attraction is not in your package');
      break;
    }
    default:
      return refuse('Unknown change type');
  }

  built = assembleTrip(sel, catalog); // rebuilds everything and runs every rule
  if (!built.ok) return refuse(...built.errors.map((e) => e.message));
  return {
    ok: true,
    trip: built.trip,
    delta_inr: built.trip.total_inr - trip.total_inr,
    notes: [...changeNotes(trip, built.trip, catalog), ...tripNotes(built.trip, catalog)],
  };
}

// ---------- what the traveler can choose, with the REAL price difference of each choice ----------
export function listOptions(trip, catalog) {
  const sel = selectionFromTrip(trip, catalog);
  const dry = (change) => applyChange(trip, change, catalog); // never saves anything
  const options = { hotels: {}, flights: { arrival: [], return: [] }, attractions: [] };

  // hotels: every hotel in each city of the trip, with its cheapest room that works
  for (const stay of sel.stays) {
    const list = [];
    for (const hotel of catalog.hotelsByCity.get(stay.city) ?? []) {
      const r = dry({ type: 'SET_HOTEL', city: stay.city, hotel_id: hotel.hotel_id });
      if (!r.ok) continue;
      const room = catalog.roomById.get(r.trip.items.find((i) => i.type === 'hotel' && i.city === stay.city).room_id);
      list.push({
        hotel_id: hotel.hotel_id, name: hotel.name, stars: hotel.stars, rating: hotel.rating, area: hotel.area,
        room_id: room.room_id, room_name: room.name,
        delta_inr: r.delta_inr, current: hotel.hotel_id === stay.hotel_id,
      });
    }
    options.hotels[stay.city] = list.sort((a, b) => a.delta_inr - b.delta_inr);
  }

  // flights: same date and airport rules as the planner, shown only when the whole package still works
  const country = catalog.countryByName.get(trip.country);
  const home = sel.request.departure_airport;
  const first = sel.stays[0].city;
  const last = sel.stays[sel.stays.length - 1].city;
  for (const dir of ['arrival', 'return']) {
    const city = dir === 'arrival' ? first : last;
    const currentId = dir === 'arrival' ? sel.arrival_flight_id : sel.return_flight_id;
    for (const ap of catalog.raw.airports) {
      if (ap.country !== country.code || !ap.serves_cities?.includes(city)) continue;
      const route = dir === 'arrival' ? `${home}>${ap.code}` : `${ap.code}>${home}`;
      for (const f of catalog.flightsByRoute.get(route) ?? []) {
        const date = (dir === 'arrival' ? f.arrival_local : f.departure_local).slice(0, 10);
        if (date !== (dir === 'arrival' ? trip.start_date : trip.end_date)) continue;
        const r = dry({ type: 'SET_FLIGHT', direction: dir, flight_id: f.flight_id });
        if (!r.ok) continue;
        options.flights[dir].push({
          flight_id: f.flight_id, name: `${f.airline} ${f.flight_number} ${f.from} to ${f.to}`,
          departure_local: f.departure_local.slice(0, 16), arrival_local: f.arrival_local.slice(0, 16),
          stops: f.stops, duration_minutes: f.duration_minutes, price_per_seat: f.price_per_seat.amount,
          delta_inr: r.delta_inr, current: f.flight_id === currentId, notes: r.notes,
        });
      }
    }
    options.flights[dir].sort((a, b) => a.delta_inr - b.delta_inr);
  }

  // attractions: every attraction in a city of the trip that is not in it yet, with the days it fits
  const inTrip = new Set(sel.visits.map((v) => v.attraction_id));
  const cities = new Set(sel.stays.map((s) => s.city));
  for (const att of catalog.raw.attractions) {
    if (!cities.has(att.city) || inTrip.has(att.attraction_id)) continue;
    const slots = [];
    for (let d = trip.start_date; d < trip.end_date; d = addDays(d, 1)) {
      const found = findVisit(sel, att, catalog, { date: d });
      if (found.visit) slots.push({ date: d, start: found.visit.start });
    }
    if (slots.length === 0) continue;
    const first = dry({ type: 'ADD_ATTRACTION', attraction_id: att.attraction_id, date: slots[0].date, start: slots[0].start });
    options.attractions.push({
      attraction_id: att.attraction_id, name: att.name, city: att.city, category: att.category,
      visit_minutes: att.visit_minutes, delta_inr: first.ok ? first.delta_inr : 0, slots,
    });
  }
  options.attractions.sort((a, b) => a.city.localeCompare(b.city) || a.delta_inr - b.delta_inr);
  return options;
}
