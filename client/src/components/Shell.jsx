import Header from './Header.jsx';
import Stepper from './Stepper.jsx';

// The frame for every page after the landing page: Back button, progress, page content.
export default function Shell({ onBack, backLabel, step, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header onBack={onBack} backLabel={backLabel} />
      <Stepper current={step} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
