import { useState, useEffect } from 'react';

// Same limits the backend enforces (server/src/engine/request.js)
const MIN_NIGHTS = 3;
const MAX_NIGHTS = 10;

const STEPS = [
  { title: 'Enter your trip', text: 'Departure city, country, dates, travelers and budget.' },
  { title: 'Get a full package', text: 'Flights, hotels, transfers and a day-by-day plan.' },
  { title: 'Change anything', text: 'Swap a hotel or flight, add or remove attractions.' },
  { title: 'Confirm', text: 'Get a 10-digit reservation number.' },
];

// Returns { field: message }. Empty object = valid. Field names match the backend.
// Dates outside 1-20 April are NOT rejected here: the planner answers them with a reason (M2).
export function validateRequest(f) {
  const e = {};
  if (!f.departure_airport) e.departure_airport = 'Choose a departure city.';
  if (!f.country) e.country = 'Choose a destination country.';
  if (!f.start_date) e.start_date = 'Pick the holiday start date.';

  const nights = Number(f.nights);
  if (!Number.isInteger(nights) || nights < MIN_NIGHTS || nights > MAX_NIGHTS)
    e.nights = `Nights must be a whole number from ${MIN_NIGHTS} to ${MAX_NIGHTS}.`;

  const adults = Number(f.adults);
  if (!Number.isInteger(adults) || adults < 1 || adults > 9) e.adults = 'Adults must be a whole number from 1 to 9.';

  f.child_ages.forEach((a, i) => {
    const n = Number(a);
    if (a === '' || !Number.isInteger(n) || n < 0 || n > 17) e[`child_${i}`] = 'Age must be 0 to 17.';
  });

  const budget = Number(f.budget_inr);
  if (!f.budget_inr || !Number.isFinite(budget) || budget <= 0) e.budget_inr = 'Enter a budget in ₹ greater than 0.';

  return e;
}

function Field({ label, error, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-sm font-semibold text-slate-700">{label}</label>
      {children}
      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const inputCls = (err) =>
  `rounded-lg border bg-white px-3 py-2.5 text-base outline-none focus:ring-2 focus:ring-blue-500 ${
    err ? 'border-red-500' : 'border-slate-300'
  }`;

/**
 * Props:
 *  departureCities: [{ airport, city }]  (GET /api/destinations)
 *  countries:       [{ code, name }]     (GET /api/destinations)
 *  onSubmit(request)                     -> POST /api/plan
 *  fieldErrors                           -> per-field messages from a 400 response
 *  loading, serverError                  -> optional, for M2 / M8 messages
 */
export default function Landing({ departureCities = [], countries = [], onSubmit, onLookup, fieldErrors = {}, loading = false, serverError = '' }) {
  const [form, setForm] = useState({
    departure_airport: '',
    country: '',
    start_date: '',
    nights: 6,
    adults: 2,
    child_ages: [],
    budget_inr: '',
  });
  const [errors, setErrors] = useState({});
  const err = { ...errors, ...fieldErrors }; // local checks + messages from the backend

  // "Find my booking" popup
  const [lookupOpen, setLookupOpen] = useState(false);
  const [code, setCode] = useState('');
  const [lookupError, setLookupError] = useState('');
  const [looking, setLooking] = useState(false);

  const closeLookup = () => {
    setLookupOpen(false);
    setCode('');
    setLookupError('');
  };

  useEffect(() => {
    if (!lookupOpen) return;
    const onKey = (e) => e.key === 'Escape' && closeLookup();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lookupOpen]);

  const submitLookup = async (e) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(code)) {
      setLookupError('Enter the 10-digit reservation number (digits only).');
      return;
    }
    setLooking(true);
    setLookupError('');
    try {
      // onLookup should resolve on success, or throw / return false when not found
      const ok = onLookup ? await onLookup(code) : (window.location.hash = `#/reservation/${code}`, true);
      if (ok === false) setLookupError('Reservation not found. Check the number and try again.');
      else closeLookup();
    } catch {
      setLookupError('Reservation not found. Check the number and try again.');
    } finally {
      setLooking(false);
    }
  };

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const setChildCount = (count) => {
    const n = Math.max(0, Math.min(8, Number(count) || 0));
    const ages = form.child_ages.slice(0, n);
    while (ages.length < n) ages.push('');
    setForm({ ...form, child_ages: ages });
  };

  const setAge = (i, v) => {
    const ages = [...form.child_ages];
    ages[i] = v;
    setForm({ ...form, child_ages: ages });
  };

  const submit = (e) => {
    e.preventDefault();
    const errs = validateRequest(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSubmit?.({
      departure_airport: form.departure_airport,
      country: form.country,
      start_date: form.start_date,
      nights: Number(form.nights),
      adults: Number(form.adults),
      child_ages: form.child_ages.map(Number),
      budget_inr: Number(form.budget_inr),
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <a href="/" className="text-2xl font-bold tracking-tight text-blue-700">
            Build My <span className="text-orange-500">Holiday</span>
          </a>
          <button
            type="button"
            onClick={() => setLookupOpen(true)}
            className="ml-auto rounded-md px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
          >
            Find my booking
          </button>
        </div>
      </header>

      <section className="relative overflow-hidden pb-32 pt-16 text-white">
        <img
          src="/hero.jpg"
          alt="Dubai skyline with the Burj Khalifa"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
        {/* dark overlay keeps the white text readable on the bright sky */}
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/75 via-blue-900/45 to-blue-950/70" />
        <div className="relative mx-auto max-w-6xl px-4">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">
            Tell us where. We will plan the whole holiday.
          </h1>
          <p className="mt-3 max-w-xl text-blue-100">
            Flights, hotels, airport transfers and attractions, put together correctly and within your budget.
          </p>
        </div>
      </section>

      <main className="relative z-10 mx-auto -mt-20 max-w-6xl space-y-12 px-4 pb-20">
        <form onSubmit={submit} noValidate className="rounded-xl bg-white p-6 shadow-xl">
          <div className="grid gap-5 md:grid-cols-4">
            <Field label="Departure city" error={err.departure_airport}>
              <select value={form.departure_airport} onChange={set('departure_airport')} className={inputCls(err.departure_airport)}>
                <option value="">Select city</option>
                {departureCities.map((c) => (
                  <option key={c.airport} value={c.airport}>
                    {c.city}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Destination country" error={err.country}>
              <select value={form.country} onChange={set('country')} className={inputCls(err.country)}>
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Holiday start date" error={err.start_date}>
              <input
                type="date"
                value={form.start_date}
                onChange={set('start_date')}
                className={inputCls(err.start_date)}
              />
            </Field>

            <Field label="Nights (3 to 10)" error={err.nights}>
              <input
                type="number"
                min={MIN_NIGHTS}
                max={MAX_NIGHTS}
                value={form.nights}
                onChange={set('nights')}
                className={inputCls(err.nights)}
              />
            </Field>

            <Field label="Adults" error={err.adults}>
              <input type="number" min="1" max="10" value={form.adults} onChange={set('adults')} className={inputCls(err.adults)} />
            </Field>

            <Field label="Children">
              <input
                type="number"
                min="0"
                max="8"
                value={form.child_ages.length}
                onChange={(e) => setChildCount(e.target.value)}
                className={inputCls(false)}
              />
            </Field>

            <Field label="Budget for everything (₹)" error={err.budget_inr} className="md:col-span-2">
              <input
                type="number"
                min="1"
                placeholder="350000"
                value={form.budget_inr}
                onChange={set('budget_inr')}
                className={inputCls(err.budget_inr)}
              />
            </Field>
          </div>

          {form.child_ages.length > 0 && (
            <div className="mt-5 grid gap-5 sm:grid-cols-4">
              {form.child_ages.map((age, i) => (
                <Field key={i} label={`Child ${i + 1} age`} error={err[`child_${i}`]}>
                  <input
                    type="number"
                    min="0"
                    max="17"
                    value={age}
                    onChange={(e) => setAge(i, e.target.value)}
                    className={inputCls(err[`child_${i}`])}
                  />
                </Field>
              ))}
            </div>
          )}

          {serverError && (
            <p role="alert" className="mt-5 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-orange-500 px-8 py-3 text-lg font-bold text-white hover:bg-orange-600 disabled:opacity-60 md:w-auto"
          >
            {loading ? 'Building your package…' : 'Build my holiday'}
          </button>
        </form>

        <section>
          <h2 className="mb-5 text-2xl font-bold">How it works</h2>
          <ol className="grid gap-4 md:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-slate-200 bg-white p-5">
                <span className="text-sm font-bold text-orange-500">Step {i + 1}</span>
                <h3 className="mt-1 font-semibold text-blue-700">{s.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

      </main>

      {lookupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeLookup}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookup-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 id="lookup-title" className="text-xl font-bold">Find my booking</h2>
              <button
                type="button"
                onClick={closeLookup}
                aria-label="Close"
                className="-mr-2 -mt-1 rounded-md px-2 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100"
              >
                ×
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">Enter your 10-digit reservation number.</p>

            <form onSubmit={submitLookup} className="mt-4 space-y-3">
              <input
                autoFocus
                inputMode="numeric"
                maxLength={10}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 4829150736"
                className={`${inputCls(lookupError)} w-full tracking-widest`}
              />
              {lookupError && (
                <p role="alert" className="text-sm font-medium text-red-600">{lookupError}</p>
              )}
              <button
                type="submit"
                disabled={looking}
                className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {looking ? 'Searching…' : 'Find booking'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}