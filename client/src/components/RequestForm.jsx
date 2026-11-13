import { useState, useEffect, useRef } from 'react';
import Credits from './Credits.jsx';

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

  if (f.rooms !== '' && f.rooms !== undefined) {
    const r = Number(f.rooms);
    if (!Number.isInteger(r) || r < 1 || r > adults) e.rooms = 'Rooms must be between 1 and the number of adults.';
  }

  f.child_ages.forEach((a, i) => {
    const n = Number(a);
    if (a === '' || !Number.isInteger(n) || n < 0 || n > 17) e.child_ages = "Choose every child's age.";
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

const MAX_ADULTS = 9;
const MAX_CHILDREN = 8;

function CountStepper({ label, hint, value, min, max, onChange }) {
  const btn = 'flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 text-xl leading-none text-blue-700 transition hover:bg-blue-50 active:scale-90 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div>
        <p className="font-semibold">{label}</p>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`Fewer ${label.toLowerCase()}`}>−</button>
        <span className="w-5 text-center text-lg font-bold tabular-nums" aria-live="polite">{value}</span>
        <button type="button" className={btn} onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`More ${label.toLowerCase()}`}>+</button>
      </div>
    </div>
  );
}

// One field for the whole group, like Agoda: adults, children (with their ages) and rooms in a dropdown.
// Rooms: "Automatic" lets the planner pick the fewest rooms that fit; otherwise the traveler sets the number (1 to adults).
function TravelersField({ adults, ages, rooms, onAdults, onChildren, onAge, onRooms, error }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return;
    const away = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); window.removeEventListener('keydown', esc); };
  }, [open]);

  useEffect(() => { if (error) setOpen(true); }, [error]); // show what is missing (a child's age)

  const kids = ages.length;
  const summary = `${adults} adult${adults > 1 ? 's' : ''}${kids ? `, ${kids} child${kids > 1 ? 'ren' : ''}` : ''}`;

  return (
    <div ref={box} className="relative flex flex-col gap-1 md:col-span-2">
      <label id="travelers-label" className="text-sm font-semibold text-slate-700">Travelers and rooms</label>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-labelledby="travelers-label"
        className={`flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2.5 text-left text-base outline-none transition focus:ring-2 focus:ring-blue-500 ${error ? 'border-red-500' : open ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'}`}>
        <span className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
          </svg>
          <span>
            {summary}
            <span className="text-slate-400"> · {rooms === '' ? 'rooms: auto' : `${rooms} room${rooms > 1 ? 's' : ''}`}</span>
          </span>
        </span>
        <svg viewBox="0 0 24 24" className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}

      {open && (
        <div role="dialog" aria-label="Travelers and rooms" className="absolute left-0 right-0 top-full z-30 mt-2 max-h-[75vh] overflow-y-auto rounded-xl md:bottom-full md:top-auto md:mb-2 md:mt-0 border border-slate-200 bg-white p-4 shadow-2xl animate-pop md:right-auto md:w-96">
          <div className="flex items-center justify-between gap-4 pb-3">
            <div>
              <p className="font-semibold">Rooms</p>
              <p className="text-xs text-slate-500">{rooms === '' ? 'We choose the fewest rooms that fit your group.' : 'Each room is checked against its capacity.'}</p>
            </div>
            <div className="flex overflow-hidden rounded-full border border-slate-300 text-sm font-semibold">
              <button type="button" onClick={() => onRooms('')} className={`whitespace-nowrap px-3 py-1.5 transition ${rooms === '' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-blue-50'}`}>Auto</button>
              <button type="button" onClick={() => onRooms(rooms === '' ? 1 : rooms)} className={`whitespace-nowrap px-3 py-1.5 transition ${rooms !== '' ? 'bg-blue-700 text-white' : 'text-slate-600 hover:bg-blue-50'}`}>I choose</button>
            </div>
          </div>
          {rooms !== '' && (
            <div className="rounded-lg bg-blue-50/60 px-3 animate-fade-in">
              <CountStepper label="Number of rooms" hint={`1 to ${adults} (at least one adult per room)`} value={rooms} min={1} max={adults} onChange={onRooms} />
            </div>
          )}
          <div className="divide-y divide-slate-100 border-t border-slate-100">
            <CountStepper label="Adults" hint="Age 18 and over" value={adults} min={1} max={MAX_ADULTS} onChange={onAdults} />
            <CountStepper label="Children" hint="Age 0 to 17" value={kids} min={0} max={MAX_CHILDREN} onChange={onChildren} />
          </div>

          {kids > 0 && (
            <div className="border-t border-slate-100 pt-3">
              <p className="mb-2 text-sm font-semibold text-slate-700">Children's ages</p>
              <div className="grid grid-cols-2 gap-3">
                {ages.map((age, i) => (
                  <select key={i} value={age} onChange={(e) => onAge(i, e.target.value)} aria-label={`Child ${i + 1} age`}
                    className={`rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 animate-fade-in ${age === '' && error ? 'border-red-500' : 'border-slate-300'}`}>
                    <option value="">Child {i + 1} age</option>
                    {Array.from({ length: 18 }, (_, a) => <option key={a} value={a}>{a} {a === 1 ? 'year' : 'years'}</option>)}
                  </select>
                ))}
              </div>
            </div>
          )}

          <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white transition hover:bg-blue-800 active:scale-95">Done</button>
        </div>
      )}
    </div>
  );
}

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
    rooms: '',
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

  const setAdults = (n) => {
    const adults = Math.max(1, Math.min(MAX_ADULTS, n));
    setForm({ ...form, adults, rooms: form.rooms === '' ? '' : Math.min(form.rooms, adults) });
  };
  const setRooms = (r) => setForm({ ...form, rooms: r === '' ? '' : Math.max(1, Math.min(form.adults, Number(r))) });

  const setChildCount = (count) => {
    const n = Math.max(0, Math.min(MAX_CHILDREN, Number(count) || 0));
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
      ...(form.rooms === '' ? {} : { rooms: Number(form.rooms) }),
    });
  };

  return (
    <div className="relative flex min-h-screen flex-col text-white">
      {/* the photo is the whole page background; the gradient keeps text readable */}
      <img src="/hero.jpg" alt="" aria-hidden="true" className="fixed inset-0 -z-20 h-full w-full object-cover object-center" />
      <div className="fixed inset-0 -z-10 bg-gradient-to-b from-blue-950/80 via-blue-900/50 to-blue-950/80" />

      <header className="flex items-center px-5 py-3 sm:px-8">
        <a href="/" className="text-2xl font-bold tracking-tight text-white drop-shadow">
          Build My <span className="text-orange-400">Holiday</span>
        </a>
        <button
          type="button"
          onClick={() => setLookupOpen(true)}
          className="group ml-auto flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-base font-bold text-blue-700 shadow-lg ring-2 ring-white/40 transition hover:-translate-y-0.5 hover:bg-orange-500 hover:text-white hover:ring-orange-300 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
          Find my booking
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-6 px-5 pb-6 sm:px-8">
        <div>
          <h1 className="max-w-5xl text-3xl font-bold leading-tight drop-shadow animate-fade-up md:text-4xl">
            Tell us where. We will plan the whole holiday.
          </h1>
          <p style={{ animationDelay: '120ms' }} className="mt-2 max-w-xl text-blue-100 animate-fade-up">
            Flights, hotels, airport transfers and attractions, put together correctly and within your budget.
          </p>
        </div>

        <form onSubmit={submit} noValidate style={{ animationDelay: '200ms' }} className="relative z-20 rounded-xl bg-white p-5 text-slate-800 shadow-2xl animate-fade-up">
          <div className="grid gap-4 md:grid-cols-4">
            <Field label="Departure city" error={err.departure_airport}>
              <select value={form.departure_airport} onChange={set('departure_airport')} className={inputCls(err.departure_airport)}>
                <option value="">Select city</option>
                {departureCities.map((c) => (
                  <option key={c.airport} value={c.airport}>{c.city}</option>
                ))}
              </select>
            </Field>

            <Field label="Destination country" error={err.country}>
              <select value={form.country} onChange={set('country')} className={inputCls(err.country)}>
                <option value="">Select country</option>
                {countries.map((c) => (
                  <option key={c.code} value={c.name}>{c.name}</option>
                ))}
              </select>
            </Field>

            <Field label="Start date (1 to 20 April 2027)" error={err.start_date}>
              <input type="date" value={form.start_date} onChange={set('start_date')} className={inputCls(err.start_date)} />
            </Field>

            <Field label="Nights (3 to 10)" error={err.nights}>
              <input type="number" min={MIN_NIGHTS} max={MAX_NIGHTS} value={form.nights} onChange={set('nights')} className={inputCls(err.nights)} />
            </Field>

            <TravelersField adults={Number(form.adults)} ages={form.child_ages} rooms={form.rooms} onAdults={setAdults} onChildren={setChildCount} onAge={setAge} onRooms={setRooms}
              error={err.child_ages || err.adults || err.rooms} />

            <Field label="Budget for everything (₹)" error={err.budget_inr}>
              <input type="number" min="1" placeholder="350000" value={form.budget_inr} onChange={set('budget_inr')} className={inputCls(err.budget_inr)} />
            </Field>

            <div className="flex items-end">
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-orange-500 px-4 py-2.5 text-base font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:opacity-60">
                {loading ? 'Building…' : 'Build my holiday'}
              </button>
            </div>
          </div>

          {serverError && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-red-700">{serverError}</p>
          )}
        </form>

        <section aria-label="How it works">
          <h2 className="mb-3 text-lg font-bold drop-shadow">How it works</h2>
          <ol className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-1 flex-col items-center gap-2 md:flex-row">
                <div style={{ animationDelay: `${i * 80}ms` }}
                  className="w-full flex-1 rounded-xl border border-white/20 bg-white/15 p-4 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:bg-white/25 animate-fade-up">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-bold">{i + 1}</span>
                    <h3 className="font-semibold">{s.title}</h3>
                  </div>
                  <p className="mt-1 text-sm text-blue-100">{s.text}</p>
                </div>
                {i < STEPS.length - 1 && (
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 rotate-90 text-orange-300 md:rotate-0" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                )}
              </li>
            ))}
          </ol>
        </section>
      </main>

      <footer className="px-5 pb-3 text-xs text-blue-100/80 sm:px-8">
        <Credits />
      </footer>

      {lookupOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in"
          onClick={closeLookup}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="lookup-title"
            className="w-full max-w-md rounded-xl bg-white p-6 text-slate-800 shadow-2xl animate-pop"
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
                className="w-full rounded-lg bg-blue-700 py-2.5 font-semibold text-white transition hover:bg-blue-800 active:scale-95 disabled:opacity-60"
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