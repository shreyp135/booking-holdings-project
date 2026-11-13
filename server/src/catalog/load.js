// Reads the read-only catalog JSON files once at startup.
// The catalog never changes, so it lives in memory (fast for the solver).
// Mongo is only used for OUR state: packages and reservations.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../data/catalog');
const read = (f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8'));

export function loadRaw() {
  return {
    destinations: read('destinations.json'),
    airports: read('airports.json'),
    flights: read('flights.json'),
    hotels: read('hotels.json'),
    rooms: read('rooms.json'),
    availability: read('availability.json'),
    transfers: read('transfers.json'),
    attractions: read('attractions.json'),
  };
}
