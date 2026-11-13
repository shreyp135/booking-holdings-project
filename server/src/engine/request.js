// Validates the traveler's request form (M1). Pure function, used by the API.
// Returns { ok, errors: { field: message }, value } where `value` is the cleaned request.
//
// NOTE: a request that is well-formed but has no package (for example dates outside
// 1-20 April) is VALID input. The planner answers it with "no package, because ...".
import { dayNumber } from './time.js';

const isIsoDate = (s) => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

export function validateRequest(body, catalog) {
  const errors = {};
  const b = body || {};

  const dep = catalog.departureCities.find((c) => c.airport === b.departure_airport);
  if (!dep) errors.departure_airport = 'Choose a departure city from the list';

  if (!catalog.countryByName.has(b.country)) errors.country = 'Choose a destination country from the list';

  if (!isIsoDate(b.start_date)) errors.start_date = 'Enter a valid holiday start date (YYYY-MM-DD)';

  const { min_nights, max_nights } = catalog.rules;
  if (!Number.isInteger(b.nights) || b.nights < min_nights || b.nights > max_nights)
    errors.nights = `Nights must be a whole number from ${min_nights} to ${max_nights}`;

  if (!Number.isInteger(b.adults) || b.adults < 1 || b.adults > 9)
    errors.adults = 'Adults must be a whole number from 1 to 9';

  const ages = b.child_ages ?? [];
  if (!Array.isArray(ages) || ages.length > 9 || !ages.every((a) => Number.isInteger(a) && a >= 0 && a <= 17))
    errors.child_ages = 'Each child age must be a whole number from 0 to 17';

  if (typeof b.budget_inr !== 'number' || !Number.isFinite(b.budget_inr) || b.budget_inr <= 0)
    errors.budget_inr = 'Budget must be a positive number (INR)';

  // rooms is optional: leave it out and we pick the fewest rooms that fit. If given, 1 room up to one per adult.
  const hasRooms = b.rooms !== undefined && b.rooms !== null && b.rooms !== '';
  if (hasRooms && (!Number.isInteger(b.rooms) || b.rooms < 1 || b.rooms > (Number.isInteger(b.adults) ? b.adults : 9)))
    errors.rooms = 'Rooms must be a whole number from 1 up to the number of adults (one adult per room at least)';

  const ok = Object.keys(errors).length === 0;
  if (!ok) return { ok, errors, value: null };

  return {
    ok,
    errors,
    value: {
      departure_airport: dep.airport,
      departure_city: dep.city,
      country: b.country,
      start_date: b.start_date,
      nights: b.nights,
      adults: b.adults,
      rooms: hasRooms ? b.rooms : null,
      child_ages: ages,
      children: ages.length,
      budget_inr: b.budget_inr,
      end_date: new Date((dayNumber(b.start_date) + b.nights) * 86400000).toISOString().slice(0, 10),
    },
  };
}
