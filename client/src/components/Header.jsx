// Top bar for every page after the landing page: the logo at the far left, and optionally a button at the far right.
export default function Header({ onBuild }) {
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="flex items-center px-5 py-3 sm:px-8">
        <span className="text-2xl font-bold tracking-tight text-blue-700">
          Build My <span className="text-orange-500">Holiday</span>
        </span>
        {onBuild && (
          <button type="button" onClick={onBuild}
            className="ml-auto flex items-center gap-2 rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-orange-600 hover:shadow-lg active:scale-95">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            Build your own trip
          </button>
        )}
      </div>
    </header>
  );
}
