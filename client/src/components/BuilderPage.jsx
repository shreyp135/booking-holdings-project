import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { inr } from './format.js';

// Build your own itinerary, step 1: choose the cities and nights. We then create an empty itinerary
// (hotels and flights only) that already follows every rule, and the traveler adds the rest.
export default function BuilderPage({ request, onCreated }) {
  const [plans, setPlans] = useState(null);
  const [choice, setChoice] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.builderPlans(request).then((r) => setPlans(r.plans)).catch((e) => setError(e.message));
  }, [request]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      onCreated(await api.builderCreate(request, plans[choice].plan));
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <h1 className="text-3xl font-bold">Build your own itinerary</h1>
        <p className="mt-1 text-slate-600">Choose where to stay and for how many nights. Next you will pick hotels, flights and attractions.</p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
      {!plans && !error && (
        <div className="grid gap-3 md:grid-cols-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-200/70" />)}
        </div>
      )}
      {plans?.length === 0 && <p className="rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">No city plan is possible for these dates.</p>}

      {plans?.length > 0 && (
        <>
          <ul className="grid gap-3 md:grid-cols-2">
            {plans.map((p, i) => (
              <li key={p.label} style={{ animationDelay: `${Math.min(i, 10) * 35}ms` }} className="animate-fade-up">
                <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border bg-white p-4 transition hover:shadow-md ${choice === i ? 'border-blue-700 ring-2 ring-blue-200' : 'border-slate-200'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="plan" checked={choice === i} onChange={() => setChoice(i)} className="h-4 w-4 accent-blue-700" />
                    <span className="font-semibold text-blue-700">{p.label}</span>
                  </span>
                  <span className="text-sm text-slate-500">hotels and flights from {inr(p.total_inr)}</span>
                </label>
              </li>
            ))}
          </ul>
          <button onClick={start} disabled={busy} className="rounded-lg bg-orange-500 px-8 py-3 text-lg font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:opacity-60">
            {busy ? 'Creating…' : 'Start building'}
          </button>
        </>
      )}
    </div>
  );
}
