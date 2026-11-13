// Same interface as the Mongo store, but in memory. Used by the tests.
export function createMemoryStore() {
  const packages = new Map();
  const reservations = new Map();
  const copy = (x) => (x ? structuredClone(x) : null);
  return {
    async savePackage(pkg) { packages.set(pkg.trip_id, copy(pkg)); },
    async getPackage(id) { return copy(packages.get(id)); },
    async tryCreateReservation(reference, trip) {
      if (reservations.has(reference)) return false;
      reservations.set(reference, { reference, trip: copy(trip) });
      return true;
    },
    async getReservation(ref) { return copy(reservations.get(ref)); },
  };
}
