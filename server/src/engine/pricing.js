// Price rules from the handout (section 4, "Prices"). All amounts are whole INR.

const amt = (p) => p.amount;

export const flightPrice = (flight, travelers) => amt(flight.price_per_seat) * travelers;

export const hotelPrice = (room, rooms, nights) => amt(room.price_per_night) * rooms * nights;

export const vehiclesNeeded = (transfer, travelers) => Math.ceil(travelers / transfer.max_passengers);

export function transferPrice(transfer, adults, children) {
  if (transfer.pricing === 'PER_VEHICLE') {
    return amt(transfer.price) * vehiclesNeeded(transfer, adults + children);
  }
  const child = transfer.child_price ? amt(transfer.child_price) : amt(transfer.price);
  return adults * amt(transfer.price) + children * child;
}

export function attractionPrice(att, adults, children) {
  const child = att.child_price ? amt(att.child_price) : amt(att.price_per_person);
  return adults * amt(att.price_per_person) + children * child;
}

// Do k rooms of this type fit the group?  (room-fit rule)
export function roomsFit(room, k, adults, children) {
  return (
    k >= 1 &&
    adults <= k * room.max_adults &&
    adults + children <= k * (room.max_adults + room.max_children) &&
    adults >= k
  );
}

// Smallest k that fits, or null if no k works.
export function minRooms(room, adults, children) {
  for (let k = 1; k <= adults; k++) if (roomsFit(room, k, adults, children)) return k;
  return null;
}

// How many rooms of this type to book. `wanted` is the number of rooms the traveler asked for (or null = fewest).
// Returns null when the group cannot fit in that many rooms of this type.
export function roomsFor(room, adults, children, wanted) {
  const min = minRooms(room, adults, children);
  if (!min) return null;
  if (!wanted) return min;
  if (min > wanted) return null;
  return roomsFit(room, wanted, adults, children) ? wanted : null;
}

// Judges accept up to 1% difference per price.
export const priceClose = (a, b) => Math.abs(a - b) <= Math.max(1, 0.01 * Math.max(a, b));
