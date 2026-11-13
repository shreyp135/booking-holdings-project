import Credits from './Credits.jsx';
import Header from './Header.jsx';
import Stepper from './Stepper.jsx';

// The frame for every page after the landing page: navbar, then Back (top left) with the progress, then the page.
export default function Shell({ onBack, backLabel = 'Back', step, children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-800">
      <Header />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-4">
        <button type="button" onClick={onBack} aria-label={backLabel}
          className="group flex items-center gap-1 rounded-md py-2 pl-1 pr-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-95">
          <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
          {backLabel}
        </button>
        <Stepper current={step} />
      </div>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 pb-4 text-center text-xs text-slate-400"><Credits /></footer>
    </div>
  );
}
