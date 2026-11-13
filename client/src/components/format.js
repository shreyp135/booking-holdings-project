export const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
export const time = (s) => (s && s.length > 10 ? s.slice(11, 16) : '');
export const delta = (n) => (n === 0 ? 'same price' : `${n > 0 ? '+' : '−'}${inr(Math.abs(n))}`);
export const hm = (min) => `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
export const clock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
