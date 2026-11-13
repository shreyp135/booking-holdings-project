// THE source of truth: checks a trip (shared trip format) against every rule in section 4.
// The planner builds packages and this file decides whether they are correct.
// It only reads the trip + catalog, it never changes anything.
import {
  absMin, addDays, dayNumber, daysBetween, inWindow, nightsBetween,
  splitDateTime, toMin, weekdayOf,
} from './time.js';
import {
  attractionPrice, flightPrice, hotelPrice, priceClose, roomsFit,
  transferPrice, vehiclesNeeded,
} from './pricing.js';

/**
 * @param trip    package in the shared trip format
 * @param catalog result of buildCatalog()
 * @param opts    { firstPackage: true } also enforces "1-2 attractions on every full day".
 *                That rule is for the FIRST package; after the traveler edits, they may remove
 *                attractions, so edits are validated with firstPackage = false.
 * @returns { valid, errors: [{ rule, message, item_id }] }
 */
export function validateTrip(trip, catalog, opts = {}) {
  const errors = [];
  const err = (rule, message, item_id = null) => errors.push({ rule, message, item_id });

  const { adults, children } = trip.traveler;
  const travelers = adults + children;
  const country = catalog.countryByName.get(trip.country);
  if (!country) {
    err('COUNTRY', `Unknown country "${trip.country}"`);
    return { valid: false, errors };
  }
  const items = trip.items || [];
  const ofType = (t) => items.filter((i) => i.type === t);

  // ---------- Dates ----------
  const nightsCount = daysBetween(trip.start_date, trip.end_date);
  const R = catalog.rules;
  if (nightsCount < R.min_nights || nightsCount > R.max_nights)
    err('NIGHTS', `Trip must be ${R.min_nights}-${R.max_nights} nights, got ${nightsCount}`);
  if (trip.start_date < R.data_window.first_night)
    err('DATES', `First night must be on or after ${R.data_window.first_night}`);
  if (trip.end_date > R.data_window.last_departure)
    err('DATES', `Return flight must be on or before ${R.data_window.last_departure}`);

  // ---------- Flights ----------
  const flightItems = ofType('flight');
  const flights = flightItems.map((it) => ({ it, f: catalog.flightById.get(it.catalog_id) }));
  let arrival = null;
  let ret = null;
  if (flights.length !== 2) err('FLIGHT_COUNT', `Need exactly 2 flights, found ${flights.length}`);
  for (const { it, f } of flights) {
    if (!f) { err('FLIGHT_UNKNOWN', `Unknown flight ${it.catalog_id}`, it.item_id); continue; }
    if (f.from === trip.traveler.home_airport) arrival = { it, f };
    else if (f.to === trip.traveler.home_airport) ret = { it, f };
    else err('FLIGHT_ROUTE', 'Flight does not start or end at the home airport', it.item_id);
    if (f.seats_left < travelers)
      err('SEATS', `Only ${f.seats_left} seats left, need ${travelers}`, it.item_id);
    if (it.quantity !== travelers)
      err('FLIGHT_QTY', `Flight quantity must be ${travelers}`, it.item_id);
  }
  if (flights.length === 2 && (!arrival || !ret))
    err('FLIGHT_COUNT', 'Need one arrival flight and one return flight');

  // ---------- Hotels (stays) ----------
  const stays = ofType('hotel')
    .map((it) => ({
      it,
      hotel: catalog.hotelById.get(it.catalog_id),
      room: catalog.roomById.get(it.room_id),
      from: it.start,
      to: it.end,
    }))
    .sort((a, b) => a.from.localeCompare(b.from));

  if (stays.length === 0) err('HOTEL_NONE', 'No hotel in the package');
  const cityCities = new Set();
  const countryCities = new Set(country.cities.map((c) => c.name));
  for (const s of stays) {
    const id = s.it.item_id;
    if (!s.hotel || !s.room) { err('HOTEL_UNKNOWN', 'Unknown hotel or room', id); continue; }
    s.city = s.hotel.city;
    if (s.it.city !== s.city) err('HOTEL_CITY', 'Item city differs from the hotel city', id);
    if (s.room.hotel_id !== s.hotel.hotel_id) err('ROOM_HOTEL', 'Room does not belong to the hotel', id);
    if (!countryCities.has(s.city)) err('CITY_COUNTRY', `${s.city} is not in ${trip.country}`, id);
    if (cityCities.has(s.city)) err('CITY_TWICE', `${s.city} appears more than once`, id);
    cityCities.add(s.city);
    s.nights = nightsBetween(s.from, s.to);
    if (s.nights.length < R.min_nights_per_city)
      err('CITY_MIN_NIGHTS', `${s.city}: at least ${R.min_nights_per_city} nights in a row`, id);
    if (!roomsFit(s.room, s.it.quantity, adults, children))
      err('ROOM_FIT', `${s.it.quantity} x ${s.room.name} do not fit ${adults} adults + ${children} children`, id);
    const avail = catalog.availability.get(s.room.room_id);
    for (const night of s.nights) {
      const left = avail?.get(night) ?? 0;
      if (left < s.it.quantity) err('ROOM_AVAILABILITY', `Only ${left} rooms left on ${night}`, id);
    }
  }
  // stays must cover every night from start to end with no gap or overlap
  if (stays.length) {
    if (stays[0].from !== trip.start_date) err('HOTEL_GAP', 'First hotel must start on the holiday start date');
    for (let i = 0; i < stays.length - 1; i++)
      if (stays[i].to !== stays[i + 1].from) err('HOTEL_GAP', `Gap or overlap between hotels ${i + 1} and ${i + 2}`);
    if (stays[stays.length - 1].to !== trip.end_date) err('HOTEL_GAP', 'Last hotel must end on the last day (no hotel night that day)');
  }
  const stayOk = stays.every((s) => s.hotel && s.room);
  const cityOfDay = (date) => stays.find((s) => s.from <= date && date < s.to)?.city ?? null;

  // ---------- Flight vs. dates / cities ----------
  if (arrival) {
    const { f, it } = arrival;
    const ap = catalog.airportByCode.get(f.to);
    if (splitDateTime(f.arrival_local).date !== trip.start_date)
      err('ARRIVAL_DATE', 'Arrival flight must land on the holiday start date (local time)', it.item_id);
    if (stays.length && !ap?.serves_cities?.includes(stays[0].city))
      err('ARRIVAL_AIRPORT', `${f.to} does not serve ${stays[0].city}`, it.item_id);
    if (ap && ap.country !== country.code) err('ARRIVAL_AIRPORT', `${f.to} is not in ${trip.country}`, it.item_id);
  }
  if (ret) {
    const { f, it } = ret;
    const ap = catalog.airportByCode.get(f.from);
    if (splitDateTime(f.departure_local).date !== trip.end_date)
      err('RETURN_DATE', 'Return flight must leave on the last day (local time)', it.item_id);
    if (stays.length && !ap?.serves_cities?.includes(stays[stays.length - 1].city))
      err('RETURN_AIRPORT', `${f.from} does not serve ${stays[stays.length - 1].city}`, it.item_id);
  }

  // ---------- Airport transfers ----------
  const transferItems = ofType('transfer').map((it) => ({ it, t: catalog.transferById.get(it.catalog_id) }));
  for (const x of transferItems) if (!x.t) err('TRANSFER_UNKNOWN', `Unknown transfer ${x.it.catalog_id}`, x.it.item_id);
  const known = transferItems.filter((x) => x.t);
  const airportTr = known.filter((x) => x.t.airport).sort((a, b) => a.it.start.localeCompare(b.it.start));
  if (airportTr.length !== 2) err('AIRPORT_TRANSFER_COUNT', `Need exactly 2 airport transfers, found ${airportTr.length}`);

  // when the traveler is actually in the first city / each new city (absolute local minutes)
  const earliestStartAbs = new Map(); // date -> minute value attractions must not start before

  if (airportTr.length === 2 && arrival && ret && stayOk && stays.length) {
    const [a, d] = airportTr;
    const first = stays[0];
    const last = stays[stays.length - 1];
    const serves = (t, stay) => t.city === stay.city && (t.area === null || t.area === stay.hotel.area);

    // arrival: airport -> first hotel
    if (a.t.airport !== arrival.f.to) err('TRANSFER_AIRPORT', 'Arrival transfer starts at a different airport than the flight lands at', a.it.item_id);
    if (!serves(a.t, first)) err('TRANSFER_HOTEL', "Arrival transfer does not serve the first hotel's city and area", a.it.item_id);
    const pickupA = splitDateTime(a.it.start);
    if (absMin(a.it.start) - absMin(arrival.f.arrival_local) < 60)
      err('TRANSFER_TIME', 'Pickup must be at least 60 minutes after landing', a.it.item_id);
    if (!inWindow(pickupA.min, a.t.service_from, a.t.service_until))
      err('TRANSFER_HOURS', `Pickup ${a.it.start.slice(11, 16)} is outside service hours ${a.t.service_from}-${a.t.service_until}`, a.it.item_id);
    earliestStartAbs.set(pickupA.date, absMin(a.it.start) + a.t.duration_minutes);

    // departure: last hotel -> airport
    if (d.t.airport !== ret.f.from) err('TRANSFER_AIRPORT', 'Departure transfer goes to a different airport than the flight leaves from', d.it.item_id);
    if (!serves(d.t, last)) err('TRANSFER_HOTEL', "Departure transfer does not serve the last hotel's city and area", d.it.item_id);
    const pickupD = splitDateTime(d.it.start);
    if (absMin(d.it.start) + d.t.duration_minutes > absMin(ret.f.departure_local) - 180)
      err('TRANSFER_TIME', 'Traveler must reach the airport at least 180 minutes before departure', d.it.item_id);
    if (!inWindow(pickupD.min, d.t.service_from, d.t.service_until))
      err('TRANSFER_HOURS', `Pickup ${d.it.start.slice(11, 16)} is outside service hours ${d.t.service_from}-${d.t.service_until}`, d.it.item_id);
  }

  // ---------- Transfers between cities ----------
  const intercity = known.filter((x) => x.t.from_city && x.t.to_city);
  const matched = new Set();
  const changeDays = new Set();
  if (stayOk) {
    for (let i = 0; i < stays.length - 1; i++) {
      const A = stays[i].city;
      const B = stays[i + 1].city;
      const day = stays[i].to;
      changeDays.add(day);
      const cands = intercity.filter((x) => x.t.from_city === A && x.t.to_city === B && x.it.start.slice(0, 10) === day);
      if (cands.length !== 1) { err('CITY_TRANSFER', `Need exactly 1 transfer ${A} -> ${B} on ${day}, found ${cands.length}`); continue; }
      const { it, t } = cands[0];
      matched.add(it.item_id);
      const link = country.links.find((l) => l.from_city === A && l.to_city === B);
      if (!link || !link.transfer_ids.includes(t.transfer_id)) err('CITY_TRANSFER', `${t.transfer_id} is not a valid link ${A} -> ${B}`, it.item_id);
      if (!inWindow(splitDateTime(it.start).min, t.service_from, t.service_until))
        err('TRANSFER_HOURS', `Departure ${it.start.slice(11, 16)} is outside service hours ${t.service_from}-${t.service_until}`, it.item_id);
      earliestStartAbs.set(day, absMin(it.start) + t.duration_minutes);
    }
  }
  for (const x of intercity) if (!matched.has(x.it.item_id)) err('CITY_TRANSFER', 'Transfer between cities on a day without a city change', x.it.item_id);

  // ---------- Attractions ----------
  const perDay = new Map();
  const seen = new Set();
  for (const it of ofType('attraction')) {
    const att = catalog.attractionById.get(it.catalog_id);
    if (!att) { err('ATTRACTION_UNKNOWN', `Unknown attraction ${it.catalog_id}`, it.item_id); continue; }
    if (seen.has(att.attraction_id)) err('ATTRACTION_TWICE', `${att.name} is in the package more than once`, it.item_id);
    seen.add(att.attraction_id);

    const { date, min } = splitDateTime(it.start);
    const end = min + att.visit_minutes;
    if (date === trip.end_date) err('ATTRACTION_LAST_DAY', 'No attractions on the last day', it.item_id);
    else if (date < trip.start_date || date > trip.end_date) err('ATTRACTION_DATE', 'Attraction is outside the trip dates', it.item_id);
    if (cityOfDay(date) !== att.city)
      err('ATTRACTION_CITY', `${att.name} is in ${att.city}, but the hotel that night is in ${cityOfDay(date)}`, it.item_id);
    if (!att.open_days.includes(weekdayOf(date))) err('ATTRACTION_CLOSED', `${att.name} is closed on ${weekdayOf(date)}`, it.item_id);
    if ((att.closed_dates || []).includes(date)) err('ATTRACTION_CLOSED', `${att.name} is closed on ${date}`, it.item_id);
    if (min < toMin(att.open_from) || end > toMin(att.open_until))
      err('ATTRACTION_HOURS', `${att.name} visit ${it.start.slice(11, 16)}+${att.visit_minutes}min is outside ${att.open_from}-${att.open_until}`, it.item_id);
    const earliest = earliestStartAbs.get(date);
    if (earliest !== undefined && dayNumber(date) * 1440 + min < earliest)
      err('ATTRACTION_TOO_EARLY', 'Visit starts before the traveler reaches the city', it.item_id);

    if (!perDay.has(date)) perDay.set(date, []);
    perDay.get(date).push({ it, start: min, end });
  }
  for (const [date, list] of perDay) {
    list.sort((a, b) => a.start - b.start);
    for (let i = 1; i < list.length; i++)
      if (list[i].start < list[i - 1].end) err('ATTRACTION_OVERLAP', `Visits overlap on ${date}`, list[i].it.item_id);
  }
  if (opts.firstPackage && stayOk) {
    for (let d = trip.start_date; d < trip.end_date; d = addDays(d, 1)) {
      const n = perDay.get(d)?.length ?? 0;
      const full = d !== trip.start_date && !changeDays.has(d);
      if (full && n < 1) err('ATTRACTIONS_PER_DAY', `${d}: a full day needs 1-2 attractions`);
      if (n > 2) err('ATTRACTIONS_PER_DAY', `${d}: at most 2 attractions`);
    }
  }

  // ---------- Prices ----------
  let sum = 0;
  for (const it of items) {
    let expected = null;
    if (it.type === 'flight') {
      const f = catalog.flightById.get(it.catalog_id);
      if (f) expected = flightPrice(f, it.quantity);
    } else if (it.type === 'hotel') {
      const room = catalog.roomById.get(it.room_id);
      if (room) expected = hotelPrice(room, it.quantity, nightsBetween(it.start, it.end).length);
    } else if (it.type === 'transfer') {
      const t = catalog.transferById.get(it.catalog_id);
      if (t) {
        expected = transferPrice(t, adults, children);
        const q = t.pricing === 'PER_VEHICLE' ? vehiclesNeeded(t, travelers) : travelers;
        if (it.quantity !== q) err('TRANSFER_QTY', `Transfer quantity must be ${q}`, it.item_id);
      }
    } else if (it.type === 'attraction') {
      const a = catalog.attractionById.get(it.catalog_id);
      if (a) expected = attractionPrice(a, adults, children);
    }
    if (expected !== null && !priceClose(expected, it.price_inr))
      err('PRICE', `Price should be ${expected}, got ${it.price_inr}`, it.item_id);
    sum += it.price_inr;
  }
  if (!priceClose(sum, trip.total_inr)) err('TOTAL', `total_inr is ${trip.total_inr} but items add up to ${sum}`);

  return { valid: errors.length === 0, errors };
}
