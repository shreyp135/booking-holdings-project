import { inr } from './format.js';

// The planner's answer when there is NO package to show: over budget (M8) or impossible (M2).
export default function PackageResult({ result }) {
  const over = result.status === 'OVER_BUDGET';
  return (
    <section role="alert" className={`rounded-xl border p-6 shadow-xl ${over ? 'border-orange-200 bg-orange-50' : 'border-red-200 bg-red-50'}`}>
      <h2 className={`text-xl font-bold ${over ? 'text-orange-700' : 'text-red-700'}`}>
        {over ? 'This is over your budget' : 'We could not build a package'}
      </h2>
      <p className="mt-2 text-slate-700">{result.message}</p>

      {over && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Box label="Your budget" value={inr(result.budget_inr)} />
            <Box label="Cheapest valid package" value={inr(result.cheapest_total_inr)} />
            <Box label="Over by" value={inr(result.over_by_inr)} bad />
          </div>
          <h3 className="mt-5 text-sm font-semibold text-slate-700">What you can do</h3>
          <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-slate-700">
            {result.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </>
      )}

      {!over && result.reasons?.length > 1 && (
        <>
          <h3 className="mt-4 text-sm font-semibold text-slate-700">Why</h3>
          <ul className="mt-1 list-disc space-y-1 pl-6 text-sm text-slate-700">
            {result.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

const Box = ({ label, value, bad }) => (
  <div className="rounded-lg bg-white p-3 ring-1 ring-slate-200">
    <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
    <p className={`text-xl font-bold ${bad ? 'text-red-600' : 'text-slate-800'}`}>{value}</p>
  </div>
);
