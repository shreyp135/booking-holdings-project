import AnimatedNumber from './AnimatedNumber.jsx';
import { citySummary, hm, inr, time } from './format.js';

const LABEL_CLS = {
  Cheapest: 'bg-emerald-100 text-emerald-800',
  Fastest: 'bg-sky-100 text-sky-800',
  'Best rated': 'bg-amber-100 text-amber-800',
  'Another option': 'bg-slate-100 text-slate-700',
};

const Row = ({ k, v, hint }) => (
  <div className="flex justify-between gap-3" title={hint}>
    <dt className="text-slate-500">{k}</dt>
    <dd className="font-semibold tabular-nums text-slate-800">{v}</dd>
  </div>
);

// The packages we found (cheapest / fastest / best rated), plus "Build your own itinerary".
// `options` are package views: { trip, total_inr, budget_inr, balance_inr, meta }.
export default function OptionsPage({ options, request, onOpen, onBuild }) {
  const kids = request.child_ages?.length ?? 0;
  const people = `${request.adults} adult${request.adults > 1 ? 's' : ''}${kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`;
  return (
    <div className="space-y-8">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold">Choose your holiday</h1>
        <p className="mt-1 text-slate-600">
          {request.country} · {request.start_date} to {request.end_date} · {people} · budget {inr(request.budget_inr)}
        </p>
        <p className="mt-1 text-sm text-slate-500">Every package can be customized: cities, hotels, flights and attractions.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {options.map((o, idx) => {
          const flights = o.trip.items.filter((i) => i.type === 'flight');
          const hotels = o.trip.items.filter((i) => i.type === 'hotel');
          const labels = o.meta?.labels ?? [];
          return (
            <article key={o.trip.trip_id} style={{ animationDelay: `${idx * 90}ms` }}
              className="group flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-up">
              <div className="flex flex-wrap gap-2">
                {labels.map((l) => (
                  <span key={l} className={`rounded px-2 py-0.5 text-xs font-semibold ${LABEL_CLS[l] ?? LABEL_CLS['Another option']}`}>{l}</span>
                ))}
              </div>
              <h2 className="mt-3 text-xl font-bold text-blue-700">{citySummary(o.trip)}</h2>
              <p className="mt-3 text-3xl font-bold tabular-nums"><AnimatedNumber value={o.total_inr} /></p>
              <p className={`text-sm font-semibold ${o.balance_inr < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {o.balance_inr < 0 ? `${inr(-o.balance_inr)} over budget` : `${inr(o.balance_inr)} left in budget`}
              </p>

              <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm">
                <Row k="Travel time" v={o.meta ? hm(o.meta.travelMinutes) : '–'} hint="flights and transfers between cities" />
                <Row k="Hotel stars" v={o.meta ? `${o.meta.avgStars.toFixed(1)} average` : '–'} />
                {flights.map((f) => (
                  <Row key={f.item_id} k="Flight" v={`${f.start.slice(5, 10)} ${time(f.start)} → ${time(f.end)}`} />
                ))}
              </dl>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {hotels.map((h) => <li key={h.item_id}>{h.name} <span className="text-slate-400">({h.city})</span></li>)}
              </ul>

              <div className="mt-auto pt-6">
                <button onClick={() => onOpen(o)}
                  className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 active:scale-95">
                  View and customize
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <article style={{ animationDelay: `${options.length * 90}ms` }}
        className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-blue-300 bg-white p-6 transition hover:border-blue-500 hover:shadow-md md:flex-row md:items-center animate-fade-up">
        <div>
          <span className="text-sm font-bold text-orange-500">Your way</span>
          <h2 className="text-xl font-bold text-blue-700">Build your own itinerary</h2>
          <p className="mt-1 text-sm text-slate-600">Choose the cities yourself, then pick every hotel, flight and attraction. We check each choice against the rules.</p>
        </div>
        <button onClick={onBuild} className="shrink-0 rounded-lg bg-blue-700 px-6 py-3 font-semibold text-white transition hover:bg-blue-800 active:scale-95">Start building</button>
      </article>
    </div>
  );
}
