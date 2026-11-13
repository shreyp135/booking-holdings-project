export const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
export const time = (s) => (s && s.length > 10 ? s.slice(11, 16) : '');
export const delta = (n) => (n === 0 ? 'same price' : `${n > 0 ? '+' : '−'}${inr(Math.abs(n))}`);
export const hm = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
export const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

// "Tokyo (3) → Kyoto (3)" from the hotel items of a trip
export function citySummary(trip) {
  return trip.items
    .filter((i) => i.type === 'hotel')
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((h) => `${h.city} (${nightsOf(h.start, h.end)})`)
    .join(' → ');
}
