import { useEffect, useState } from 'react';

const MESSAGES = [
  'Checking flights and free seats…',
  'Finding hotels with rooms for your group…',
  'Matching airport transfers to your flight times…',
  'Planning attractions day by day…',
  'Checking every rule one last time…',
];

// Full-screen overlay shown while the planner works (about a second), so the wait feels purposeful.
export default function BuildingScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => Math.min(x + 1, MESSAGES.length - 1)), 700);
    return () => clearInterval(id);
  }, []);
  return (
    <div role="status" aria-live="polite" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-blue-950/80 p-6 text-center text-white backdrop-blur-sm animate-fade-in">
      <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-orange-400" />
      <p className="mt-6 text-2xl font-bold">Building your holiday</p>
      <p key={i} className="mt-2 text-blue-100 animate-fade-up">{MESSAGES[i]}</p>
    </div>
  );
}
