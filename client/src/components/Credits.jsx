import { useEffect, useState } from 'react';

// Licence credits for the photos (required by images/ATTRIBUTIONS.md). Small link that opens the full list.
export default function Credits({ className = '' }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!open || rows) return;
    fetch('/api/credits').then((r) => r.json()).then((d) => setRows(d.credits)).catch(() => setRows([]));
  }, [open, rows]);

  useEffect(() => {
    if (!open) return;
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`underline-offset-2 hover:underline ${className}`}>Photo credits</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Photo credits" onClick={(e) => e.stopPropagation()}
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-white p-6 text-slate-800 shadow-2xl animate-pop">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-bold">Photo credits</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="-mr-2 -mt-1 rounded-md px-2 py-1 text-2xl leading-none text-slate-500 hover:bg-slate-100">×</button>
            </div>
            <p className="mt-1 text-sm text-slate-500">Photos are used under their open licences. Hotel pictures are generic room photos.</p>
            <ul className="mt-3 space-y-2 overflow-y-auto pr-1 text-sm">
              {rows === null && <li className="text-slate-400">Loading…</li>}
              {rows?.map((c) => (
                <li key={c.file} className="rounded-lg bg-slate-50 px-3 py-2">
                  <span className="font-semibold">{c.used_for}</span>
                  <span className="text-slate-500"> · {c.author} · </span>
                  {c.source.url ? <a className="text-blue-700 underline" href={c.source.url} target="_blank" rel="noreferrer">source</a> : c.source.text}
                  <span className="text-slate-500"> · </span>
                  {c.license.url ? <a className="text-blue-700 underline" href={c.license.url} target="_blank" rel="noreferrer">{c.license.text}</a> : c.license.text}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
