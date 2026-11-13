import { useEffect, useRef, useState } from 'react';
import { inr } from './format.js';

// Shows a rupee amount that counts smoothly to its new value (about 0.4 s) whenever it changes.
export default function AnimatedNumber({ value, format = inr }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 400);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(a + (value - a) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); from.current = value; };
  }, [value]);
  return <>{format(shown)}</>;
}
