import { useEffect, useState } from 'react';
import { api } from './api.js';
import RequestForm from './components/RequestForm.jsx';
import Shell from './components/Shell.jsx';
import OptionsPage from './components/OptionsPage.jsx';
import BuilderPage from './components/BuilderPage.jsx';
import BuildingScreen from './components/BuildingScreen.jsx';
import PackageView, { ResultNotice } from './components/PackageView.jsx';

const KEY = 'bmh_state'; // what the traveler was looking at, so a page refresh brings it back
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// a package from POST /plan, shaped like a stored package
const asView = (o) => ({ trip: o.trip, status: 'PLANNED', reference: null, total_inr: o.total_inr, budget_inr: o.budget_inr, balance_inr: o.balance_inr, notes: o.notes ?? [], meta: o.meta, media: o.media });

export default function App() {
  const [meta, setMeta] = useState({ departureCities: [], countries: [] });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [view, setView] = useState('landing'); // landing | options | builder | package | notice
  const [request, setRequest] = useState(null); // the validated request from the last plan
  const [options, setOptions] = useState([]);   // the packages offered for it
  const [pkg, setPkg] = useState(null);         // the package that is open
  const [notice, setNotice] = useState(null);   // planner said: over budget / no package
  const [backTo, setBackTo] = useState('landing');

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // start: load the form data, then restore what was open before a refresh
  useEffect(() => {
    (async () => {
      try {
        setMeta(await api.destinations());
      } catch {
        setLoadError('Cannot reach the server. Start it with "npm start" from the project root.');
        setReady(true);
        return;
      }
      try {
        const s = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (s) {
          const get = (id) => api.getPackage(id).catch(() => null);
          const opts = (await Promise.all((s.optionIds ?? []).map(get))).filter(Boolean);
          const open = s.openId ? await get(s.openId) : null;
          setRequest(s.request);
          setOptions(opts);
          if (s.view === 'package' && open) { setPkg(open); setBackTo(s.backTo); setView('package'); }
          else if (s.view === 'options' && opts.length) setView('options');
          else if (s.view === 'builder' && s.request) setView('builder');
        }
      } catch {
        localStorage.removeItem(KEY);
      }
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (view === 'landing' || view === 'notice') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ view, backTo, request, optionIds: options.map((o) => o.trip.trip_id), openId: pkg?.trip.trip_id ?? null }));
  }, [ready, view, backTo, request, options, pkg]);

  const go = (v) => { setView(v); window.scrollTo(0, 0); };

  const handleSubmit = async (req) => {
    setLoading(true);
    setFieldErrors({});
    setServerError('');
    try {
      const [result] = await Promise.all([api.plan(req), sleep(900)]); // OK, OVER_BUDGET or NO_PACKAGE
      if (result.status === 'OK') {
        setRequest(result.request);
        setOptions(result.options.map(asView));
        go('options');
      } else {
        setNotice(result);
        go('notice');
      }
    } catch (e) {
      setFieldErrors(e.fields || {});
      setServerError(e.fields ? '' : e.message);
    } finally {
      setLoading(false);
    }
  };

  // "Find my booking": true = opened, false = not found
  const handleLookup = async (code) => {
    try {
      const res = await api.reservation(code);
      setPkg(res);
      setBackTo('landing');
      go('package');
      return true;
    } catch (e) {
      if (e.status === 404) return false;
      throw e;
    }
  };

  const open = (p, from) => { setPkg(p); setBackTo(from); go('package'); };

  // every accepted change or confirmation updates the open package and its card in the list
  const update = (next) => {
    setPkg((p) => ({ ...p, ...next }));
    setOptions((list) => list.map((o) => (o.trip.trip_id === next.trip.trip_id ? { ...o, ...next } : o)));
  };

  const back = () => {
    if (view === 'package') {
      setPkg(null);
      go(backTo === 'options' && options.length ? 'options' : backTo === 'builder' ? 'builder' : 'landing');
    } else if (view === 'builder' && options.length) {
      go('options');
    } else {
      setOptions([]);
      go('landing');
    }
  };

  if (!ready) return <p className="m-6 text-slate-500">Loading…</p>;

  const step = view === 'package' ? (pkg?.status === 'BOOKED' ? 3 : 2) : view === 'notice' ? 0 : 1;
  const backLabel = view === 'package' && backTo === 'landing' ? 'Back to home' : 'Back';

  return (
    <>
      {/* The form stays mounted (hidden) so going Back keeps what was typed */}
      <div className={view === 'landing' ? '' : 'hidden'}>
        <RequestForm
          {...meta}
          onSubmit={handleSubmit}
          fieldErrors={fieldErrors}
          serverError={loadError || serverError}
          loading={loading}
          onLookup={handleLookup}
        />
      </div>
      {loading && <BuildingScreen />}

      {view !== 'landing' && (
        <Shell onBack={back} backLabel={backLabel} step={step}>
          <div key={view + (pkg?.trip.trip_id ?? '')} className="animate-fade-in">
            {view === 'options' && <OptionsPage options={options} request={request} onOpen={(o) => open(o, 'options')} onBuild={() => go('builder')} />}
            {view === 'builder' && <BuilderPage request={request} onCreated={(p) => open(p, 'builder')} />}
            {view === 'package' && pkg && <PackageView pkg={pkg} onUpdate={update} />}
            {view === 'notice' && notice && <ResultNotice result={notice} onBack={() => go('landing')} />}
          </div>
        </Shell>
      )}
    </>
  );
}
