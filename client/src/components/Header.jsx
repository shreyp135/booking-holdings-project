// Top bar for every page after the landing page: the logo, at the far left.
export default function Header() {
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="flex items-center px-5 py-3 sm:px-8">
        <span className="text-2xl font-bold tracking-tight text-blue-700">
          Build My <span className="text-orange-500">Holiday</span>
        </span>
      </div>
    </header>
  );
}
