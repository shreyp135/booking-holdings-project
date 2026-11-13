// Top bar for the package pages (the landing page has its own, with the "Find my booking" popup).
export default function Header({ onHome, homeLabel = 'Plan another holiday' }) {
  return (
    <header className="bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
        <button type="button" onClick={onHome} className="text-2xl font-bold tracking-tight text-blue-700">
          Build My <span className="text-orange-500">Holiday</span>
        </button>
        <button type="button" onClick={onHome} className="ml-auto rounded-md px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
          {homeLabel}
        </button>
      </div>
    </header>
  );
}
