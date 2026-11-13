// Top bar for every page after the landing page: a Back button at the top left, then the logo.
export default function Header({ onBack, backLabel = 'Back' }) {
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="group flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {backLabel}
        </button>
        <span className="text-2xl font-bold tracking-tight text-blue-700">
          Build My <span className="text-orange-500">Holiday</span>
        </span>
      </div>
    </header>
  );
}
