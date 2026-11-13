// Builds lookup maps on top of the raw catalog so the engine never scans arrays.
import { loadRaw } from './load.js';

const group = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) {
    const k = keyFn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
};
const byId = (arr, key) => new Map(arr.map((x) => [x[key], x]));

export function buildCatalog() {
  const raw = loadRaw();

  // availability: room_id -> { 'YYYY-MM-DD' -> rooms_left }
  const availability = new Map();
  for (const a of raw.availability) {
    if (!availability.has(a.room_id)) availability.set(a.room_id, new Map());
    availability.get(a.room_id).set(a.date, a.rooms_left);
  }

  const countries = raw.destinations.countries;

  return {
    raw,
    rules: raw.destinations.rules,
    departureCities: raw.destinations.departure_cities,
    countries,
    countryByName: new Map(countries.map((c) => [c.name, c])),
    airportByCode: byId(raw.airports, 'code'),
    flightById: byId(raw.flights, 'flight_id'),
    // flights: "FROM>TO" -> list
    flightsByRoute: group(raw.flights, (f) => `${f.from}>${f.to}`),
    hotelById: byId(raw.hotels, 'hotel_id'),
    hotelsByCity: group(raw.hotels, (h) => h.city),
    roomById: byId(raw.rooms, 'room_id'),
    roomsByHotel: group(raw.rooms, (r) => r.hotel_id),
    availability,
    transferById: byId(raw.transfers, 'transfer_id'),
    // airport transfers: "AIRPORT|City" -> list (filter by area later)
    airportTransfers: group(
      raw.transfers.filter((t) => t.airport),
      (t) => `${t.airport}|${t.city}`
    ),
    attractionById: byId(raw.attractions, 'attraction_id'),
    attractionsByCity: group(raw.attractions, (a) => a.city),
  };
}
