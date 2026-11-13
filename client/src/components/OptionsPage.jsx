import { useEffect, useMemo, useState } from 'react';
import AnimatedNumber from './AnimatedNumber.jsx';
import { cityRoute, hm, inr, nightsOfTrip, photo, time } from './format.js';

const LABEL_CLS = {
  Cheapest: 'bg-emerald-100 text-emerald-800',
  Fastest: 'bg-sky-100 text-sky-800',
  'Best rated': 'bg-amber-100 text-amber-800',
  'Another option': 'bg-slate-100 text-slate-700',
};

const Stat = ({ k, v }) => (
  <div className="flex justify-between gap-3 text-sm">
    <dt className="text-slate-500">{k}</dt>
    <dd className="font-semibold tabular-nums text-slate-800">{v}</dd>
  </div>
);

// One cover photo per card: the first photo of its own gallery that no earlier card already uses.
function pickCovers(options) {
  const used = new Set();
  return options.map((o) => {
    const g = o.media?.gallery ?? [];
    const pick = g.find((p) => !used.has(p)) ?? g[0] ?? null;
    if (pick) used.add(pick);
    return photo(pick);
  });
}

// The arrow that opens "view and customize"; the label shows on hover or keyboard focus.
function OpenArrow({ onClick }) {
  return (
    <button type="button" onClick={onClick} aria-label="View and customize"
      className="group/arrow relative flex h-12 w-12 items-center justify-center rounded-full bg-orange-500 text-white shadow-lg transition hover:scale-110 hover:bg-orange-600 active:scale-95">
      <svg viewBox="0 0 24 24" className="h-6 w-6 transition-transform group-hover/arrow:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      <span role="tooltip" className="pointer-events-none absolute bottom-full right-0 mb-2 whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover/arrow:opacity-100 group-focus-visible/arrow:opacity-100">
        View and customize
      </span>
    </button>
  );
}

function Card({ o, cover, active, onSelect, onOpen, delay }) {
  const { trip } = o;
  const labels = o.meta?.labels ?? [];
  const flights = trip.items.filter((i) => i.type === 'flight');
  const attractions = trip.items.filter((i) => i.type === 'attraction').length;
  const nights = nightsOfTrip(trip);
  const over = o.balance_inr < 0;

  return (
    <article
      onClick={active ? undefined : onSelect}
      onKeyDown={active ? undefined : (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect())}
      role={active ? undefined : 'button'} tabIndex={active ? undefined : 0}
      aria-label={active ? undefined : `${labels.join(', ')}: ${cityRoute(trip)}. Show this package.`}
      style={{ animationDelay: `${delay}ms` }}
      className={`relative min-h-0 overflow-hidden rounded-3xl bg-slate-800 shadow-lg animate-fade-up ${active ? '' : 'cursor-pointer hover:shadow-xl'}`}>

      {/* photo: the left half of the open card, the whole strip of a closed one */}
      {cover
        ? <img src={cover} alt="" loading="lazy" className={`absolute inset-y-0 left-0 h-full object-cover transition-all duration-700 max-md:w-full ${active ? 'w-1/2 max-md:h-[42%]' : 'w-full hover:scale-105'}`} />
        : <div className="absolute inset-0 bg-gradient-to-br from-blue-700 to-blue-900" />}
      <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/10 transition-opacity duration-500 ${active ? 'opacity-0' : 'opacity-100'}`} />

      {/* closed: vertical label */}
      <div className={`absolute inset-0 flex items-end justify-between gap-2 p-4 text-white transition-opacity duration-300 max-md:items-center md:flex-col md:items-start md:justify-end ${active ? 'pointer-events-none opacity-0' : 'opacity-100 delay-200'}`}>
        <span className="rounded bg-white/90 px-2 py-0.5 text-xs font-bold text-slate-800 md:[writing-mode:vertical-rl] md:rotate-180">{labels[0] ?? 'Package'}</span>
        <span className="text-sm font-semibold md:[writing-mode:vertical-rl] md:rotate-180">{cityRoute(trip)}</span>
        <span className="text-sm font-bold tabular-nums md:[writing-mode:vertical-rl] md:rotate-180">{inr(o.total_inr)}</span>
      </div>

      {/* open: basic details on the right half */}
      <div {...(active ? {} : { inert: '', 'aria-hidden': true })} className={`absolute inset-y-0 right-0 flex w-1/2 flex-col bg-white p-6 transition-opacity duration-500 max-md:inset-x-0 max-md:bottom-0 max-md:top-[42%] max-md:w-full max-md:p-4 ${active ? 'opacity-100 delay-300' : 'pointer-events-none opacity-0'}`}>
        <div className="flex flex-wrap gap-2">
          {labels.map((l) => <span key={l} className={`rounded px-2 py-0.5 text-xs font-semibold ${LABEL_CLS[l] ?? LABEL_CLS['Another option']}`}>{l}</span>)}
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-tight text-blue-700">{cityRoute(trip)}</h2>
        <p className="text-sm text-slate-500">{nights} nights · {attractions} attraction{attractions === 1 ? '' : 's'} planned</p>

        <p className="mt-3 text-3xl font-bold tabular-nums">{active ? <AnimatedNumber value={o.total_inr} /> : inr(o.total_inr)}</p>
        <p className={`text-sm font-semibold ${over ? 'text-red-600' : 'text-emerald-600'}`}>
          {over ? `${inr(-o.balance_inr)} over budget` : `${inr(o.balance_inr)} left in budget`}
        </p>

        <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          <Stat k="Travel time" v={o.meta ? hm(o.meta.travelMinutes) : '–'} />
          <Stat k="Hotel stars" v={o.meta ? `${o.meta.avgStars.toFixed(1)} average` : '–'} />
          {flights.map((f) => <Stat key={f.item_id} k="Flight" v={`${f.start.slice(5, 10)} ${time(f.start)} → ${time(f.end)}`} />)}
        </dl>

        <div className="mt-auto flex justify-end pt-3"><OpenArrow onClick={() => onOpen(o)} /></div>
      </div>
    </article>
  );
}

// The packages we found, as a horizontal carousel (one wide card, the others as strips), plus "Build your own itinerary".
// `options` are package views: { trip, total_inr, budget_inr, balance_inr, meta, media }.
export default function OptionsPage({ options, request, onOpen, onBuild }) {
  const [active, setActive] = useState(0);
  const covers = useMemo(() => pickCovers(options), [options]);
  useEffect(() => { if (active >= options.length) setActive(0); }, [options.length, active]);

  const kids = request.child_ages?.length ?? 0;
  const people = `${request.adults} adult${request.adults > 1 ? 's' : ''}${kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`;
  const cols = options.map((_, i) => (i === active ? '5fr' : '0.7fr')).join(' ');
  const rows = options.map((_, i) => (i === active ? '30rem' : '4.5rem')).join(' ');

  const onKey = (e) => {
    if (e.key === 'ArrowRight') setActive((a) => Math.min(options.length - 1, a + 1));
    if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, a - 1));
  };

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold">Choose your holiday</h1>
        <p className="mt-1 text-slate-600">
          {request.country} · {request.start_date} to {request.end_date} · {people} · budget {inr(request.budget_inr)}
        </p>
        <p className="mt-1 text-sm text-slate-500">Pick a package, then open it with the arrow to view and customize it.</p>
      </div>

      <div className="carousel md:h-[min(30rem,calc(100vh-18rem))] md:min-h-[24rem]" style={{ '--cols': cols, '--rows': rows }} onKeyDown={onKey} role="group" aria-label="Packages">
        {options.map((o, i) => (
          <Card key={o.trip.trip_id} o={o} cover={covers[i]} active={i === active} delay={i * 90}
            onSelect={() => setActive(i)} onOpen={onOpen} />
        ))}
      </div>

      <article className="flex flex-col items-start justify-between gap-4 rounded-xl border border-dashed border-blue-300 bg-white p-5 transition hover:border-blue-500 hover:shadow-md md:flex-row md:items-center animate-fade-up">
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
