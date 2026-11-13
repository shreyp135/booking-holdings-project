import { useEffect, useState } from 'react';
import { api } from '../api.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import ChangePanel from './ChangePanel.jsx';
import Toast from './Toast.jsx';
import { delta, inr } from './format.js';

const TABS = ['Cities', 'Flights', 'Hotels', 'Attractions'];
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const labelOf = (trip) =>
  trip.items.filter((i) => i.type === 'hotel').sort((a, b) => a.start.localeCompare(b.start))
    .map((h) => `${h.city} (${nightsOf(h.start, h.end)})`).join(' → ');

// Fixed box on the right: running total against the budget, and the way on to the review page.
function BudgetBox({ pkg, request, onReview }) {
  const trip = pkg?.trip;
  const total = trip?.total_inr ?? 0;
  const left = request.budget_inr - total;
  const parts = [['Flights', 'flight'], ['Transfers', 'transfer'], ['Hotels', 'hotel'], ['Attractions', 'attraction']].map(([label, type]) => ({
    label, sum: (trip?.items ?? []).filter((i) => i.type === type).reduce((s, i) => s + i.price_inr, 0),
  }));
  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-20 lg:self-start">
      <div>
        <p className="text-sm text-slate-500">Your trip so far</p>
        <p key={total} className="-mx-1 rounded px-1 text-3xl font-bold tabular-nums animate-flash">{trip ? <AnimatedNumber value={total} /> : '–'}</p>
      </div>
      <dl className="space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-slate-500">Your budget</dt><dd className="font-semibold tabular-nums">{inr(request.budget_inr)}</dd></div>
        {trip && (
          <div className="flex justify-between">
            <dt className="text-slate-500">{left >= 0 ? 'Left in budget' : 'Over budget by'}</dt>
            <dd className={`font-bold tabular-nums ${left >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{inr(Math.abs(left))}</dd>
          </div>
        )}
      </dl>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full transition-all duration-500 ${left >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${Math.min(100, (total / request.budget_inr) * 100)}%` }} />
      </div>
      {trip && (
        <ul className="space-y-1 border-t border-slate-100 pt-3 text-sm">
          {parts.map((p) => <li key={p.label} className="flex justify-between"><span className="text-slate-600">{p.label}</span><span className="tabular-nums">{inr(p.sum)}</span></li>)}
        </ul>
      )}
      <div className="border-t border-slate-100 pt-4">
        <button type="button" onClick={onReview} disabled={!trip}
          className="w-full rounded-lg bg-orange-500 py-3 font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50">
          Review your trip
        </button>
        {!trip && <p className="mt-2 text-xs text-slate-500">Choose your cities first. Then pick flights, hotels and attractions.</p>}
      </div>
    </aside>
  );
}

// Build your own trip: everything on one page, in tabs (cities, flights, hotels, attractions),
// with the budget always visible. "Review your trip" goes straight to the review page.
export default function BuilderPage({ request, initialPkg = null, onCreated }) {
  const [plans, setPlans] = useState(null);
  const [pkg, setPkg] = useState(initialPkg);
  const [tab, setTab] = useState(initialPkg ? 'Flights' : 'Cities');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    api.builderPlans(request).then((r) => setPlans(r.plans)).catch((e) => setError(e.message));
  }, [request]);

  const current = pkg ? labelOf(pkg.trip) : null;

  async function choose(plan) {
    setBusy(true);
    setError('');
    try {
      const made = await api.builderCreate(request, plan.plan);
      setPkg(made);
      setVersion((v) => v + 1);
      setTab('Flights');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function change(ch, label) {
    setBusy(true);
    try {
      const res = await api.change(pkg.trip.trip_id, ch);
      setPkg((p) => ({ ...p, ...res }));
      setVersion((v) => v + 1);
      setToast({ kind: 'ok', lines: [`${label}. Price ${delta(res.delta_inr)}.`, ...res.change_notes] });
    } catch (e) {
      setToast({ kind: 'error', lines: ['That change was refused:', ...(e.reasons ?? [e.message])] });
    } finally {
      setBusy(false);
    }
  }

  const attractions = pkg?.trip.items.filter((i) => i.type === 'attraction') ?? [];

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold">Build your own trip</h1>
        <p className="mt-1 text-slate-600">Work through the tabs in any order after choosing your cities. Every choice is checked against the rules.</p>
      </div>

      <div role="tablist" className="flex gap-6 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => {
          const locked = t !== 'Cities' && !pkg;
          return (
            <button key={t} role="tab" aria-selected={tab === t} disabled={locked} onClick={() => setTab(t)}
              className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-3 text-lg font-semibold transition ${tab === t ? 'border-emerald-400 text-slate-800' : 'border-transparent text-slate-400 hover:text-slate-600'} ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
              {t}
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div key={tab} className="min-w-0 animate-fade-in">
          {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}

          {tab === 'Cities' && (
            <>
              {pkg && <p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Choosing different cities starts your itinerary again (hotels and flights are chosen again, attractions are cleared).</p>}
              {!plans && !error && (
                <div className="grid gap-3 md:grid-cols-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}</div>
              )}
              {plans?.length === 0 && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">No city plan is possible for these dates.</p>}
              <ul className="grid gap-3 md:grid-cols-2">
                {plans?.map((p, i) => {
                  const picked = current === p.label;
                  return (
                    <li key={p.label} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }} className="animate-fade-up">
                      <button type="button" disabled={busy} onClick={() => choose(p)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60 ${picked ? 'border-blue-700 ring-2 ring-blue-200' : 'border-slate-200'}`}>
                        <span className="font-semibold text-blue-700">{p.label}</span>
                        {picked
                          ? <span className="rounded-full bg-blue-700 px-3 py-1 text-xs font-semibold text-white">Chosen</span>
                          : <span className="text-sm text-slate-500">hotels and flights from {inr(p.total_inr)}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          {tab !== 'Cities' && pkg && (
            <>
              {tab === 'Attractions' && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="font-bold">Your attractions ({attractions.length})</h3>
                  {attractions.length === 0 ? <p className="mt-1 text-sm text-slate-500">None yet. Add some from the list below.</p> : (
                    <ul className="mt-2 divide-y divide-slate-100 text-sm">
                      {attractions.map((a) => (
                        <li key={a.item_id} className="flex items-center justify-between gap-3 py-2">
                          <span><span className="font-medium">{a.name}</span> <span className="text-slate-500">· {a.city} · {a.start.slice(0, 10)} {a.start.slice(11, 16)}</span></span>
                          <span className="flex items-center gap-3">
                            <span className="tabular-nums">{inr(a.price_inr)}</span>
                            <button type="button" disabled={busy} aria-label={`Remove ${a.name}`} onClick={() => change({ type: 'REMOVE_ATTRACTION', attraction_id: a.catalog_id }, `${a.name} removed`)}
                              className="rounded px-1.5 text-lg leading-none text-slate-300 transition hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-40">×</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <ChangePanel tripId={pkg.trip.trip_id} version={version} onChange={change} busy={busy} tab={tab} hideTabs tabs={TABS} />
            </>
          )}
        </div>

        <BudgetBox pkg={pkg} request={request} onReview={() => onCreated(pkg)} />
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
