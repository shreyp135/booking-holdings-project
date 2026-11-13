import { useEffect } from 'react';
import { inr } from './format.js';

// "Are you sure?" before a booking is made. Escape or a click outside closes it.
export default function ConfirmDialog({ trip, busy, onCancel, onConfirm }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !busy && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const left = trip.budget_inr - trip.total_inr;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-fade-in" onClick={() => !busy && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl animate-pop">
        <h2 id="confirm-title" className="text-xl font-bold">Confirm your booking?</h2>
        <p className="mt-2 text-slate-600">You will get a 10-digit reservation number. A confirmed booking can no longer be changed.</p>
        <dl className="mt-4 space-y-1 rounded-lg bg-slate-50 p-4 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Total</dt><dd className="font-bold">{inr(trip.total_inr)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">Left in budget</dt><dd className="font-semibold text-emerald-600">{inr(left)}</dd></div>
        </dl>
        <div className="mt-5 flex gap-3">
          <button onClick={onCancel} disabled={busy} className="flex-1 rounded-lg border border-slate-300 py-2.5 font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50">Keep editing</button>
          <button onClick={onConfirm} disabled={busy} className="flex-1 rounded-lg bg-orange-500 py-2.5 font-bold text-white transition hover:bg-orange-600 active:scale-95 disabled:opacity-60">
            {busy ? 'Booking…' : 'Yes, book it'}
          </button>
        </div>
      </div>
    </div>
  );
}
