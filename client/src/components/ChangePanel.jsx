import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { clock, delta, hm, inr, photo } from './format.js';

const TABS = ['Cities', 'Hotels', 'Flights', 'Attractions'];
const btn = 'rounded-lg border border-blue-700 px-4 py-1.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-95 disabled:opacity-40';

function Thumb({ src }) {
  return src ? <img src={photo(src)} alt="" loading="lazy" className="h-14 w-20 shrink-0 rounded-lg object-cover" /> : null;
}

function Row({ title, sub, d, current, busy, action, image, label = 'Choose' }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="flex min-w-0 items-center gap-3">
        <Thumb src={image} />
        <div className="min-w-0">
          <p className="font-medium text-slate-800">{title}</p>
          <p className="text-sm text-slate-500">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-sm font-semibold ${d > 0 ? 'text-red-600' : d < 0 ? 'text-green-700' : 'text-slate-500'}`}>{delta(d)}</span>
        {current
          ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">Current</span>
          : <button disabled={busy} onClick={action} className={btn}>{label}</button>}
      </div>
    </li>
  );
}

// Lists what the traveler can choose, each with its real price difference (G2).
// Choosing something calls onChange(change, label); the backend re-checks the whole package.
// tabs: which tabs to offer. tab/hideTabs: let the parent control the tab (build-your-own page).
// focus { city, date }: only show that city's hotels and attractions, and only that day's attraction times.
export default function ChangePanel({ tripId, version, onChange, busy, startTab = 'Cities', tabs = TABS, tab: forcedTab, hideTabs = false, focus }) {
  const [own, setTab] = useState(startTab);
  const tab = forcedTab ?? own;
  const [options, setOptions] = useState(null);
  const [slot, setSlot] = useState({}); // attraction_id -> chosen date

  useEffect(() => {
    setOptions(null);
    api.options(tripId).then(setOptions).catch(() => setOptions({ cities: [], hotels: {}, flights: { arrival: [], return: [] }, attractions: [] }));
  }, [tripId, version]); // reload after every accepted change

  if (!options)
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-6" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded bg-slate-100" />
        {[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}
      </div>
    );

  const shownAttractions = options.attractions
    .filter((a) => !focus?.city || a.city === focus.city)
    .map((a) => (focus?.date ? { ...a, slots: a.slots.filter((x) => x.date === focus.date) } : a))
    .filter((a) => a.slots.length > 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <div className={`mb-4 flex flex-wrap gap-2 ${hideTabs ? 'hidden' : ''}`}>
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition active:scale-95 ${tab === t ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{t}</button>
        ))}
      </div>

      <div key={tab} className="animate-fade-in">
      {tab === 'Cities' && (
        <div>
          <p className="mb-2 text-sm text-slate-500">Another city plan rebuilds the package: hotels, transfers and attractions are chosen again for the new route.</p>
          <ul>
            {options.cities.map((c) => (
              <Row key={c.label} busy={busy} current={c.current} d={c.delta_inr} title={c.label}
                sub={`Total ${inr(c.total_inr)}`}
                action={() => onChange({ type: 'SET_CITIES', plan: c.plan }, `Cities changed to ${c.label}`)} />
            ))}
          </ul>
        </div>
      )}

      {tab === 'Hotels' && Object.entries(options.hotels).filter(([city]) => !focus?.city || city === focus.city).map(([city, list]) => (
        <div key={city} className="mb-4">
          <h4 className="font-bold text-blue-700">{city}</h4>
          <ul>
            {list.map((h) => (
              <Row key={h.hotel_id} busy={busy} current={h.current} d={h.delta_inr} image={h.image}
                title={`${h.name}  ${'★'.repeat(h.stars)}`}
                sub={`${h.area} · ${h.room_name} · guest rating ${h.rating}`}
                action={() => onChange({ type: 'SET_HOTEL', city, hotel_id: h.hotel_id }, `Hotel in ${city} changed to ${h.name}`)} />
            ))}
          </ul>
        </div>
      ))}

      {tab === 'Flights' && ['arrival', 'return'].map((dir) => (
        <div key={dir} className="mb-4">
          <h4 className="font-bold capitalize text-blue-700">{dir} flight</h4>
          {options.flights[dir].length === 0 && <p className="text-sm text-slate-500">No other flights work for this trip.</p>}
          <ul>
            {options.flights[dir].map((f) => (
              <Row key={f.flight_id} busy={busy} current={f.current} d={f.delta_inr}
                title={f.name}
                sub={`${f.departure_local.replace('T', ' ')} → ${f.arrival_local.replace('T', ' ')} · ${f.stops === 0 ? 'direct' : `${f.stops} stop`} · ${hm(f.duration_minutes)} · ${inr(f.price_per_seat)}/seat`}
                action={() => onChange({ type: 'SET_FLIGHT', direction: dir, flight_id: f.flight_id }, `${dir[0].toUpperCase() + dir.slice(1)} flight changed to ${f.name}`)} />
            ))}
          </ul>
        </div>
      ))}

      {tab === 'Attractions' && (
        <ul>
          {shownAttractions.length === 0 && <p className="text-sm text-slate-500">Nothing else can be added{focus?.city ? ` in ${focus.city} on this day` : ''}.</p>}
          {shownAttractions.map((a) => {
            const chosen = slot[a.attraction_id] ?? a.slots[0].date;
            const s = a.slots.find((x) => x.date === chosen) ?? a.slots[0];
            return (
              <li key={a.attraction_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 last:border-0">
                <div className="flex min-w-0 items-center gap-3">
                  <Thumb src={a.image} />
                  <div>
                    <p className="font-medium text-slate-800">{a.name}</p>
                    <p className="text-sm text-slate-500">{a.city} · {a.category.toLowerCase()} · {hm(a.visit_minutes)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-semibold ${a.delta_inr > 0 ? 'text-red-600' : 'text-slate-500'}`}>{delta(a.delta_inr)}</span>
                  <select value={chosen} onChange={(e) => setSlot({ ...slot, [a.attraction_id]: e.target.value })}
                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {a.slots.map((x) => <option key={x.date} value={x.date}>{x.date}</option>)}
                  </select>
                  <button disabled={busy} className={btn}
                    onClick={() => onChange({ type: 'ADD_ATTRACTION', attraction_id: a.attraction_id, date: s.date, start: s.start }, `Added ${a.name} on ${s.date} at ${clock(s.start)}`)}>Add</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      </div>
    </div>
  );
}
