// Time helpers. All catalog times are LOCAL strings with no UTC offset, so we never
// use JS timezones: we treat "2027-04-10T10:30" as plain numbers.

// "HH:MM" -> minutes since midnight. "24:00" -> 1440.
export function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// minutes since midnight -> "HH:MM"
export function fromMin(min) {
  const h = String(Math.floor(min / 60)).padStart(2, '0');
  const m = String(min % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// "YYYY-MM-DD" -> whole days since 1970-01-01
export function dayNumber(date) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// "YYYY-MM-DD" + n days -> "YYYY-MM-DD"
export function addDays(date, n) {
  return new Date((dayNumber(date) + n) * 86400000).toISOString().slice(0, 10);
}

// Dates from `from` up to but NOT including `to` (these are the NIGHTS of a stay).
export function nightsBetween(from, to) {
  const out = [];
  for (let d = from; dayNumber(d) < dayNumber(to); d = addDays(d, 1)) out.push(d);
  return out;
}

export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const weekdayOf = (date) => WEEKDAYS[new Date(dayNumber(date) * 86400000).getUTCDay()];

// "2027-04-10T10:30[:00]" -> { date, min }
export function splitDateTime(dt) {
  const [date, time] = dt.split('T');
  return { date, min: toMin(time.slice(0, 5)) };
}

// Absolute minutes of a local date-time. Only compare two values from the SAME place.
export function absMin(dt) {
  const { date, min } = splitDateTime(dt);
  return dayNumber(date) * 1440 + min;
}

export function makeDateTime(date, min) {
  // handles min >= 1440 by rolling to the next day
  const extraDays = Math.floor(min / 1440);
  return `${addDays(date, extraDays)}T${fromMin(min % 1440)}`;
}

// Is a clock time inside a service window? Both ends are included.
// A window like 06:00-00:30 runs past midnight (end is smaller than start).
export function inWindow(minOfDay, fromStr, untilStr) {
  const from = toMin(fromStr);
  const until = toMin(untilStr);
  if (until >= from) return minOfDay >= from && minOfDay <= until;
  return minOfDay >= from || minOfDay <= until;
}


// Absolute minutes (see absMin) -> local date-time string.
export const fromAbs = (abs) => makeDateTime('1970-01-01', abs);
