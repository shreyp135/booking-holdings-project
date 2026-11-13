// Scheduling helpers: pick pickup times and attraction visits that satisfy the time rules.
import { dayNumber, inWindow, toMin } from './time.js';

// Earliest absolute minute >= tAbs that is inside the transfer's service window.
export function earliestPickupAfter(tAbs, t) {
  if (inWindow(tAbs % 1440, t.service_from, t.service_until)) return tAbs;
  const day = Math.floor(tAbs / 1440);
  for (let d = 0; d <= 2; d++) {
    const cand = (day + d) * 1440 + toMin(t.service_from);
    if (cand >= tAbs && inWindow(cand % 1440, t.service_from, t.service_until)) return cand;
  }
  return null;
}

// Latest absolute minute <= tAbs that is inside the service window.
export function latestPickupBefore(tAbs, t) {
  if (inWindow(tAbs % 1440, t.service_from, t.service_until)) return tAbs;
  const day = Math.floor(tAbs / 1440);
  const until = Math.min(toMin(t.service_until), 1439);
  for (let d = 0; d <= 2; d++) {
    const cand = (day - d) * 1440 + until;
    if (cand <= tAbs && inWindow(cand % 1440, t.service_from, t.service_until)) return cand;
  }
  return null;
}

// Departure of a city-to-city transfer on `date`: the first slot at or after 09:00
// (trains and buses leave every `frequency_minutes` starting at service_from).
export function intercityDeparture(date, t) {
  const from = toMin(t.service_from);
  let until = toMin(t.service_until);
  if (until < from) until = 1439;
  const target = 9 * 60;
  let minute;
  if (t.frequency_minutes) {
    const n = Math.max(0, Math.ceil((target - from) / t.frequency_minutes));
    minute = from + n * t.frequency_minutes;
    if (minute > until) minute = from + Math.floor((until - from) / t.frequency_minutes) * t.frequency_minutes;
  } else {
    minute = Math.min(Math.max(target, from), until);
  }
  return dayNumber(date) * 1440 + minute;
}

// Start minute for a visit (10:00 if it fits, else opening time), or null if it can never fit.
export function visitStart(att) {
  const from = toMin(att.open_from);
  const until = toMin(att.open_until);
  if (from + att.visit_minutes > until) return null;
  const preferred = Math.max(from, 600);
  return preferred + att.visit_minutes <= until ? preferred : from;
}

// Give each day in `days` one DISTINCT attraction, with the lowest total cost.
// eligible(att, day) -> bool, cost(att) -> number. Returns [att, att, ...] or null.
// DP over "which attractions are used so far" (a bitmask). A city has <= 15 attractions,
// so this is small, and unlike a greedy pick it never misses a possible assignment.
export function assignAttractions(days, atts, eligible, cost) {
  // work out once who can go on which day and what it costs (the DP below runs this many times)
  const costs = atts.map(cost);
  const ok = days.map((d) => atts.map((a) => eligible(a, d)));
  const layers = [new Map([[0, { cost: 0 }]])];
  for (let di = 0; di < days.length; di++) {
    const next = new Map();
    for (const [mask, st] of layers[layers.length - 1]) {
      for (let i = 0; i < atts.length; i++) {
        if (mask & (1 << i) || !ok[di][i]) continue;
        const nm = mask | (1 << i);
        const c = st.cost + costs[i];
        const cur = next.get(nm);
        if (!cur || c < cur.cost) next.set(nm, { cost: c, prev: mask, pick: i });
      }
    }
    if (next.size === 0) return null;
    layers.push(next);
  }
  let bestMask = null;
  for (const [m, st] of layers[layers.length - 1]) if (bestMask === null || st.cost < layers[layers.length - 1].get(bestMask).cost) bestMask = m;
  const picks = [];
  for (let li = layers.length - 1, m = bestMask; li > 0; li--) {
    const st = layers[li].get(m);
    picks.push(atts[st.pick]);
    m = st.prev;
  }
  return picks.reverse();
}
