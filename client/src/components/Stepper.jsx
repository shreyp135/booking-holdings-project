const STEPS = ['Your trip', 'Choose a package', 'Customize and review', 'Confirmed'];

// Shows where the traveler is in the journey. `current` is an index into STEPS.
export default function Stepper({ current }) {
  return (
    <nav aria-label="Progress" className="mx-auto max-w-6xl px-4 pt-5">
      <ol className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs transition-colors duration-300 ${done ? 'bg-emerald-500 text-white' : active ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={`hidden sm:inline ${active ? 'text-blue-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>{s}</span>
              {i < STEPS.length - 1 && <span className={`h-0.5 w-6 rounded sm:w-10 transition-colors duration-300 ${done ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
