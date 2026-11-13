// Result page for POST /api/plan.
// Handles the 3 statuses the planner returns:
//   OK           -> { trip, total_inr, budget_inr, balance_inr, cities }      (M4, M5)
//   OVER_BUDGET  -> { message, cheapest_trip, over_by_inr, suggestions }       (M8)
//   NO_PACKAGE   -> { message, reasons }                                       (M2)
import { useState } from 'react';
import ChangePanel from './ChangePanel.jsx';
import { api } from '../api.js';

const inr = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
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

function Row({ entry }) {
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
    </li>
  );
}

function DayPlan({ trip }) {
  const days = buildDays(trip);
  return (
    <div className="space-y-4">
      {days.map(({ date, entries }) => {
        const n = diffDays(trip.start_date, date) + 1;
        const city = cityOn(trip, date);
        return (
          <section key={date} className="rounded-xl border border-slate-200 bg-white">
            <header className="flex flex-wrap items-baseline gap-x-3 border-b border-slate-100 px-4 py-3">
              <h3 className="text-lg font-bold">{n >= 1 ? `Day ${n}` : 'Overnight flight'}</h3>
              <span className="text-sm text-slate-500">{fmtDay(date)}</span>
              {city && n >= 1 && <span className="ml-auto text-sm font-semibold text-blue-700">{city}</span>}
            </header>
            <ul className="divide-y divide-slate-100 px-4">
              {entries.map((e, i) => (
                <Row key={`${e.it.item_id}-${e.kind}-${i}`} entry={e} />
              ))}
            </ul>
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

function Summary({ trip, over,busy, onBack, onEdit, editing, onConfirm }) {
  const total = trip.total_inr;
  const left = trip.budget_inr - total;
  const parts = Object.entries(TYPES).map(([type, v]) => ({
    ...v,
    sum: trip.items.filter((i) => i.type === type).reduce((s, i) => s + i.price_inr, 0),
  }));

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-4">
      <div>
        <p className="text-sm text-slate-500">Total price</p>
        <p className="text-3xl font-bold">{inr(total)}</p>
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

      <ul className="space-y-1 border-t border-slate-100 pt-3 text-sm">
        {parts.map((p) => (
          <li key={p.label} className="flex justify-between">
            <span className="text-slate-600">{p.label}s</span>
            <span className="tabular-nums">{inr(p.sum)}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-slate-100 pt-4">
        <button
          type="button"
          onClick={() => onConfirm?.(trip)}
          disabled={!onConfirm || over || busy}
          className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Confirm booking
        </button>
        {over && <p className="text-xs text-slate-500">This package is over your budget. Edit the trip to book.</p>}
        <button
          type="button"
          onClick={() => exportJson(trip)}
          className="w-full rounded-lg border border-blue-700 py-2.5 font-semibold text-blue-700 hover:bg-blue-50"
        >
          Download JSON
        </button>
        <button
          type="button"
          onClick={onEdit}
          disabled={over}
          className="w-full rounded-lg py-2.5 font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          {editing ? 'Done editing' : 'Edit trip'}
        </button>
      </div>
    </aside>
  );
}

function Shell({ onBack, onEdit, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <span className="text-2xl font-bold tracking-tight text-blue-700">
            Build My <span className="text-orange-500">Holiday</span>
          </span>
      
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}

export default function PackageView({ result, onBack, onConfirm, onResultChange }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState('');

  if (!result) return null;

  // M2: nothing can be built
  if (result.status === 'NO_PACKAGE') {
    return (
      <Shell onBack={onBack}>
        <div className="mx-auto max-w-2xl rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-bold">No package is possible</h1>
          <p className="mt-2 text-slate-700">{result.message}</p>
          {result.reasons?.length > 1 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {result.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <button onClick={onBack} className="mt-6 rounded-lg bg-blue-700 px-6 py-2.5 font-semibold text-white hover:bg-blue-800">
            Change the trip
          </button>
        </div>
      </Shell>
    );
  }

  const over = result.status === 'OVER_BUDGET';
  const trip = over ? result.cheapest_trip : result.trip;
  const t = trip.traveler;

  const handleChange = async (change) => {
    setBusy(true);
    setError('');
    try {
      const res = await api.change(trip.trip_id, change);
      onResultChange({ ...result, ...res }); // new trip, total, notes
      setVersion((v) => v + 1);              // makes ChangePanel reload its options
    } catch (e) {
      setError(e.reasons?.join(' ') || e.message); // the server's reason for refusing (422)
    } finally {
      setBusy(false);
    }
  };

  const handleConfirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(trip);
    } catch (e) {
      setError(e.message);
      window.scrollTo(0, 0); // the banner is at the top of the page
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell onBack={onBack}>
      {/* M8: budget too small */}
      {over && (
        <div role="alert" className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="text-lg font-bold text-red-800">This trip is over your budget</h2>
          <p className="mt-1 text-red-900">{result.message}</p>
          {result.suggestions?.length > 0 && (
            <>
              <p className="mt-3 text-sm font-semibold text-red-900">What you can change:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-red-900">
                {result.suggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm text-red-900">The cheapest valid package is shown below.</p>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-3xl font-bold">{routeOf(trip)}</h1>
        <p className="mt-1 text-slate-600">
          {fmtDay(trip.start_date)} to {fmtDay(trip.end_date)}, {trip.country}. {t.adults} adult{t.adults > 1 ? 's' : ''}
          {t.children > 0 && `, ${t.children} child${t.children > 1 ? 'ren' : ''} (age ${t.child_ages.join(', ')})`}.
        </p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {editing && !over && (
        <div className="mb-6">
          <ChangePanel tripId={trip.trip_id} version={version} busy={busy} onChange={handleChange} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <DayPlan trip={trip} />
        <Summary
          trip={trip}
          over={over}
          busy={busy}
          onBack={onBack}
          onConfirm={onConfirm ? handleConfirm : undefined}
          onEdit={() => setEditing((e) => !e)}
          editing={editing}
        /></div>
    </Shell>
  );
}