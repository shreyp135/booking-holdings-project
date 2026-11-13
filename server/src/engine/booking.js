// Confirming a package (M7): turns it into a reservation with a unique 10-digit number.
import { randomInt } from 'node:crypto';
import { validateTrip } from './validator.js';

// 10 digits, never starting with 0, kept as a string
export const makeReference = () => String(randomInt(1_000_000_000, 10_000_000_000));
export const isReference = (s) => typeof s === 'string' && /^[1-9]\d{9}$/.test(s);

const bookedCopy = (trip, reference) => ({
  ...trip,
  status: 'BOOKED',
  reference,
  items: trip.items.map((i) => ({ ...i, status: 'BOOKED', booking: { reference } })),
});

/**
 * Returns { ok: true, reference, trip } or { ok: false, status, error }.
 * Safe to call twice: a package that is already booked just returns its existing reservation.
 */
export async function confirmPackage(pkg, catalog, store) {
  if (pkg.status === 'BOOKED') return { ok: true, reference: pkg.reference, trip: pkg.trip, already: true };

  const check = validateTrip(pkg.trip, catalog); // never book a package that breaks a rule
  if (!check.valid) return { ok: false, status: 422, error: `This package no longer passes every rule: ${check.errors[0].message}` };
  if (pkg.trip.total_inr > pkg.trip.budget_inr)
    return { ok: false, status: 422, error: `The package costs ${pkg.trip.total_inr - pkg.trip.budget_inr} more than your budget. Change something to bring it within budget, then confirm.` };

  for (let attempt = 0; attempt < 20; attempt++) {
    const reference = makeReference();
    const trip = bookedCopy(pkg.trip, reference);
    if (await store.tryCreateReservation(reference, trip)) {
      await store.savePackage({ ...pkg, trip, status: 'BOOKED', reference });
      return { ok: true, reference, trip };
    }
  }
  return { ok: false, status: 500, error: 'Could not create a reservation number, please try again' };
}
