// The page for one package: day-by-day plan, price summary, customize, confirm.
// Also the read-only views for "over budget" (M8) and "no package" (M2).
import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import ChangePanel from './ChangePanel.jsx';
import ConfirmDialog from './ConfirmDialog.jsx';
import Toast from './Toast.jsx';
import { delta, inr } from './format.js';

const dateOf = (s) => s.slice(0, 10);
const timeOf = (s) => (s.length > 10 ? s.slice(11, 16) : '');
const diffDays = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const fmtDay = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  });

const TYPES = {
  flight: { label: 'Flight', cls: 'bg-sky-100 text-sky-800' },
  transfer: { label: 'Transfer', cls: 'bg-amber-100 text-amber-800' },
  hotel: { label: 'Hotel', cls: 'bg-indigo-100 text-indigo-800' },
  attraction: { label: 'Attraction', cls: 'bg-emerald-100 text-emerald-800' },
};

// Group every item under the day it happens on, in time order.
function buildDays(trip) {
  const days = new Map();
  const push = (date, entry) => {
    if (!days.has(date)) days.set(date, []);
    days.get(date).push(entry);
  };
  for (let d = trip.start_date; d <= trip.end_date; d = new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10))
    if (!days.has(d)) days.set(d, []);
  for (const it of trip.items) {
    if (it.type === 'hotel') {
      push(it.start, { kind: 'checkin', it, sort: '99:98' }); // after that day's transfers
      push(it.end, { kind: 'checkout', it, sort: '00:00' }); // before that day's transfers
    } else {
      push(dateOf(it.start), { kind: it.type, it, sort: timeOf(it.start) });
    }
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, entries]) => ({ date, entries: entries.sort((a, b) => a.sort.localeCompare(b.sort)) }));
}

const hotelsOf = (trip) => trip.items.filter((i) => i.type === 'hotel');

function cityOn(trip, date) {
  const hotels = hotelsOf(trip);
  const stay = hotels.find((h) => h.start <= date && date < h.end) ?? hotels.find((h) => h.end === date);
  return stay?.city ?? '';
}

const routeOf = (trip) => hotelsOf(trip).map((h) => `${h.city} (${diffDays(h.start, h.end)})`).join(' → ');

function Row({ entry, onRemove, busy }) {
  const { kind, it } = entry;
  const t = TYPES[kind === 'checkin' || kind === 'checkout' ? 'hotel' : kind];
  const nights = it.type === 'hotel' ? diffDays(it.start, it.end) : 0;

  let time = timeOf(it.start);
  let title = it.name;
  let detail = '';
  let price = it.price_inr;

  if (kind === 'checkin') {
    time = '';
    title = `Check in: ${it.name}`;
    detail = `${it.quantity} room${it.quantity > 1 ? 's' : ''}, ${nights} night${nights > 1 ? 's' : ''}`;
  } else if (kind === 'checkout') {
    time = '';
    title = `Check out: ${it.name}`;
    price = null; // hotel is priced once, on check-in
  } else if (kind === 'flight') {
    const arrNext = dateOf(it.end) !== dateOf(it.start);
    detail = `Arrives ${timeOf(it.end)}${arrNext ? ` on ${fmtDay(dateOf(it.end))}` : ''}, ${it.quantity} seat${it.quantity > 1 ? 's' : ''}`;
  } else if (kind === 'transfer') {
    detail = `${it.city}, arrives ${timeOf(it.end)}`;
  } else if (kind === 'attraction') {
    detail = `${timeOf(it.start)} to ${timeOf(it.end)}, ${it.quantity} ${it.quantity > 1 ? 'people' : 'person'}`;
  }

  return (
    <li className="flex items-start gap-3 py-3">
      <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-500">{time || '–'}</span>
      <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${t.cls}`}>{t.label}</span>
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{title}</p>
        {detail && <p className="text-sm text-slate-500">{detail}</p>}
      </div>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{price == null ? '' : inr(price)}</span>
      {kind === 'attraction' && onRemove && (
        <button type="button" disabled={busy} onClick={() => onRemove(it)} aria-label={`Remove ${it.name}`} title="Remove from package"
          className="-mr-1 shrink-0 rounded px-1.5 text-lg leading-none text-slate-300 transition hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-40">×</button>
      )}
    </li>
  );
}

function DayPlan({ trip, onRemove, busy }) {
  const days = buildDays(trip);
  return (
    <div className="space-y-4">
      {days.map(({ date, entries }, idx) => {
        const n = diffDays(trip.start_date, date) + 1;
        const city = cityOn(trip, date);
        return (
          <section key={date} style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }} className="rounded-xl border border-slate-200 bg-white animate-fade-up">
            <header className="flex flex-wrap items-baseline gap-x-3 border-b border-slate-100 px-4 py-3">
              <h3 className="text-lg font-bold">{n >= 1 ? `Day ${n}` : 'Overnight flight'}</h3>
              <span className="text-sm text-slate-500">{fmtDay(date)}</span>
              {city && n >= 1 && <span className="ml-auto text-sm font-semibold text-blue-700">{city}</span>}
            </header>
            {entries.length === 0 ? (
              <p className="px-4 py-4 text-sm text-slate-400">Nothing planned yet. Add attractions in Customize.</p>
            ) : (
              <ul className="divide-y divide-slate-100 px-4">
                {entries.map((e, i) => (
                  <Row key={`${e.it.item_id}-${e.kind}-${i}`} entry={e} onRemove={onRemove} busy={busy} />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}


function exportJson(trip) {
  const blob = new Blob([JSON.stringify(trip, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${trip.trip_id}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Download icon with a label that appears on hover or keyboard focus.
function DownloadButton({ trip }) {
  return (
    <button type="button" onClick={() => exportJson(trip)} aria-label="Download JSON"
      className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blue-700 text-blue-700 transition hover:bg-blue-50 active:scale-90">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <span role="tooltip" className="pointer-events-none absolute -bottom-9 right-0 whitespace-nowrap rounded-md bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        Download JSON
      </span>
    </button>
  );
}

function Summary({ trip, over, busy, onConfirm, booked }) {
  const total = trip.total_inr;
  const left = trip.budget_inr - total;
  const parts = Object.entries(TYPES).map(([type, v]) => ({
    ...v,
    sum: trip.items.filter((i) => i.type === type).reduce((s, i) => s + i.price_inr, 0),
  }));

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">Total price</p>
          <p key={total} className="-mx-1 rounded px-1 text-3xl font-bold tabular-nums animate-flash"><AnimatedNumber value={total} /></p>
        </div>
        <DownloadButton trip={trip} />
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between">
          <dt className="text-slate-500">Your budget</dt>
          <dd className="font-semibold tabular-nums">{inr(trip.budget_inr)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-slate-500">{left >= 0 ? 'Left in budget' : 'Over budget by'}</dt>
          <dd className={`font-bold tabular-nums ${left >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{inr(Math.abs(left))}</dd>
        </div>
      </dl>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full transition-all duration-500 ${left >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (total / trip.budget_inr) * 100)}%` }} />
      </div>

      <ul className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex justify-between">
            <span className="text-slate-600">{p.label}s</span>
            <span className="tabular-nums">{inr(p.sum)}</span>
          </li>
        ))}
      </ul>

      {!booked && (
        <div className="space-y-2 border-t border-slate-100 pt-4">
          <button type="button" onClick={onConfirm} disabled={!onConfirm || over || busy}
            className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
            Confirm booking
          </button>
          {over && <p className="text-xs text-slate-500">{onConfirm ? 'This package is over your budget. Customize it to bring it within budget, then confirm.' : 'This package is over your budget, so it cannot be booked.'}</p>}
        </div>
      )}
    </aside>
  );
}

const routeOfTrip = routeOf;

const LABEL_CLS = {
  Cheapest: 'bg-emerald-100 text-emerald-800',
  Fastest: 'bg-sky-100 text-sky-800',
  'Best rated': 'bg-amber-100 text-amber-800',
  'Build your own': 'bg-indigo-100 text-indigo-800',
  'Another option': 'bg-slate-100 text-slate-700',
};

function Title({ trip, labels = [] }) {
  const t = trip.traveler;
  return (
    <div className="animate-fade-up">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-3xl font-bold">{routeOfTrip(trip)}</h1>
        {labels.map((l) => <span key={l} className={`rounded px-2 py-0.5 text-xs font-semibold ${LABEL_CLS[l] ?? LABEL_CLS['Another option']}`}>{l}</span>)}
      </div>
      <p className="mt-1 text-slate-600">
        {fmtDay(trip.start_date)} to {fmtDay(trip.end_date)}, {trip.country}. {t.adults} adult{t.adults > 1 ? 's' : ''}
        {t.children > 0 && `, ${t.children} child${t.children > 1 ? 'ren' : ''} (age ${t.child_ages.join(', ')})`}.
      </p>
    </div>
  );
}

// "Customize": one place to change cities, hotels, flights and attractions. Opens and closes smoothly.
function Customize({ pkg, open, onToggle, onChange, busy, version }) {
  const [seen, setSeen] = useState(open);
  useEffect(() => { if (open) setSeen(true); }, [open]);
  const own = pkg.meta?.labels?.includes('Build your own');
  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={onToggle} aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50">
        <span>
          <span className="block text-lg font-bold">Customize your package</span>
          <span className="block text-sm text-slate-500">Change cities, hotels, flights or attractions. Each choice shows its price difference.</span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-blue-700 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="border-t border-slate-100 p-4">
            {seen && <ChangePanel tripId={pkg.trip.trip_id} version={version} onChange={onChange} busy={busy} startTab={own ? 'Attractions' : 'Cities'} />}
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ text }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(text); setDone(true); setTimeout(() => setDone(false), 1800); }}
      className="rounded-lg border border-emerald-600 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-95">
      {done ? 'Copied' : 'Copy number'}
    </button>
  );
}

// An open package. pkg = { trip, status, reference, total_inr, budget_inr, balance_inr, notes, meta }.
// onUpdate(next) is called after every accepted change and after confirming.
export default function PackageView({ pkg, onUpdate }) {
  const own = pkg.meta?.labels?.includes('Build your own');
  const booked = pkg.status === 'BOOKED';
  const [open, setOpen] = useState(!!own && !booked); // a self-built itinerary starts with the choices open
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(null);
  const [asking, setAsking] = useState(false);
  const { trip } = pkg;
  const over = pkg.balance_inr < 0;

  async function change(change, label) {
    setBusy(true);
    try {
      const res = await api.change(trip.trip_id, change);
      onUpdate(res);
      setVersion((v) => v + 1);
      setToast({ kind: 'ok', lines: [`${label}. Price ${delta(res.delta_inr)}.`, ...res.change_notes.filter((n) => !res.notes?.includes(n))] });
    } catch (e) {
      setToast({ kind: 'error', lines: ['That change was refused:', ...(e.reasons ?? [e.message])] });
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    try {
      onUpdate(await api.confirm(trip.trip_id));
      setAsking(false);
      setOpen(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setAsking(false);
      setToast({ kind: 'error', lines: [e.message] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {booked && (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 p-5 animate-pop">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-2xl text-white">✓</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-800">Booked. Your reservation number</p>
            <p className="text-3xl font-bold tracking-widest text-emerald-900">{pkg.reference}</p>
            <p className="text-sm text-emerald-800">Keep it. "Find my booking" on the home page reopens this summary with it.</p>
          </div>
          <CopyButton text={pkg.reference} />
        </div>
      )}

      <Title trip={trip} labels={pkg.meta?.labels} />

      {pkg.notes?.length > 0 && (
        <ul className="list-disc space-y-1 rounded-lg bg-amber-50 p-3 pl-8 text-sm text-amber-900 animate-fade-up">
          {pkg.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {!booked && <Customize pkg={pkg} open={open} onToggle={() => setOpen((o) => !o)} onChange={change} busy={busy} version={version} />}
          <DayPlan trip={trip} busy={busy} onRemove={booked ? undefined : (it) => change({ type: 'REMOVE_ATTRACTION', attraction_id: it.catalog_id }, `${it.name} removed`)} />
        </div>
        <Summary trip={trip} over={over} busy={busy} booked={booked} onConfirm={() => setAsking(true)} />
      </div>

      {asking && <ConfirmDialog trip={trip} busy={busy} onCancel={() => setAsking(false)} onConfirm={confirm} />}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

// M8 and M2: the planner could not give a package that fits. Over budget still shows the cheapest one.
export function ResultNotice({ result, onBack }) {
  if (result.status === 'NO_PACKAGE')
    return (
      <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6 animate-fade-up">
        <h1 className="text-2xl font-bold">No package is possible</h1>
        <p className="mt-2 text-slate-700">{result.message}</p>
        {result.reasons?.length > 1 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        )}
        <button onClick={onBack} className="mt-6 rounded-lg bg-blue-700 px-6 py-2.5 font-semibold text-white transition hover:bg-blue-800 active:scale-95">Change the trip</button>
      </div>
    );

  const trip = result.cheapest_trip;
  return (
    <div className="space-y-6">
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 animate-fade-up">
        <h2 className="text-lg font-bold text-red-800">This trip is over your budget</h2>
        <p className="mt-1 text-red-900">{result.message}</p>
        {result.suggestions?.length > 0 && (
          <>
            <p className="mt-3 text-sm font-semibold text-red-900">What you can change:</p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-900">
              {result.suggestions.map((s) => <li key={s}>{s}</li>)}
            </ul>
          </>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={onBack} className="rounded-lg bg-blue-700 px-5 py-2.5 font-semibold text-white transition hover:bg-blue-800 active:scale-95">Change the trip</button>
          <span className="text-sm text-red-900">The cheapest valid package is shown below.</span>
        </div>
      </div>
      <Title trip={trip} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DayPlan trip={trip} />
        <Summary trip={trip} over busy={false} booked={false} />
      </div>
    </div>
  );
}
