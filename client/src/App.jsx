import { useEffect, useState } from 'react';
import { api } from './api.js';

export default function App() {
  const [dest, setDest] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.destinations().then(setDest).catch((e) => setError(e.message));
  }, []);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-3xl font-bold text-slate-800">Build My Holiday</h1>
      <p className="mt-1 text-slate-500">Phase 0 scaffold: the request form comes next.</p>

      {error && <p className="mt-4 rounded bg-red-100 p-3 text-red-700">{error}</p>}
      {!dest && !error && <p className="mt-4 text-slate-500">Loading…</p>}
      {dest && (
        <div className="mt-6 rounded-lg bg-white p-4 shadow">
          <p className="font-semibold">Backend connected ✔</p>
          <p className="text-sm text-slate-600">
            From: {dest.departureCities.map((c) => c.city).join(', ')}
          </p>
          <p className="text-sm text-slate-600">
            To: {dest.countries.map((c) => `${c.name} (${c.cities.join(', ')})`).join(' · ')}
          </p>
        </div>
      )}
    </main>
  );
}
