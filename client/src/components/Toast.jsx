import { useEffect } from 'react';

// A short message in the bottom-right corner that goes away by itself.
export default function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onClose, toast.kind === 'error' ? 9000 : 5500);
    return () => clearTimeout(id);
  }, [toast, onClose]);
  if (!toast) return null;
  const error = toast.kind === 'error';
  return (
    <div role={error ? 'alert' : 'status'} className="fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))] animate-toast">
      <div className={`rounded-xl border p-4 text-sm shadow-xl ${error ? 'border-red-200 bg-red-50 text-red-900' : 'border-emerald-200 bg-white text-slate-800'}`}>
        <div className="flex items-start gap-2">
          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${error ? 'bg-red-500' : 'bg-emerald-500'}`}>{error ? '!' : '✓'}</span>
          <div className="min-w-0 flex-1 space-y-1">
            {toast.lines.map((l) => <p key={l}>{l}</p>)}
          </div>
          <button onClick={onClose} aria-label="Dismiss" className="-mr-1 -mt-1 rounded px-1.5 text-lg leading-none text-slate-400 hover:bg-slate-100">×</button>
        </div>
      </div>
    </div>
  );
}
