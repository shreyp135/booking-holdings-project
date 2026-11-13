import { useEffect, useState } from 'react';
import RequestForm from './Components/RequestForm';

export default function App() {
  const [meta, setMeta] = useState({ departureCities: [], countries: [] });

  useEffect(() => {
    fetch('/api/meta').then(r => r.json()).then(setMeta);
  }, []);

  return <RequestForm
  {...meta}
  onSubmit={(req) => console.log(req)}
  onLookup={async (code) => {
    const res = await fetch(`/api/reservations/${code}`);
    if (!res.ok) return false;          // shows "not found"
    const data = await res.json();
    // show the summary page here, e.g. setReservation(data)
    return true;                        // closes the popup
  }}
/>;
}
