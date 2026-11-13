import { useEffect, useState } from 'react';
import RequestForm from './components/RequestForm';
import PackageView from './components/PackageView';
import { api } from './api';

export default function App() {
  const [meta, setMeta] = useState({ departureCities: [], countries: [] });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // response from POST /api/plan

  useEffect(() => {
    api
      .destinations()
      .then(setMeta)
      .catch(() => setServerError('Cannot reach the server. Start it with "npm start" from the project root.'));
  }, []);

  const handleSubmit = async (request) => {
    setLoading(true);
    setFieldErrors({});
    setServerError('');
    try {
      setResult(await api.plan(request)); // OK, OVER_BUDGET or NO_PACKAGE: PackageView shows all three
      window.scrollTo(0, 0);
    } catch (e) {
      setFieldErrors(e.fields || {});
      setServerError(e.fields ? '' : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Form stays mounted (hidden) so "Edit trip" keeps what was typed */}
      <div className={result ? 'hidden' : ''}>
        <RequestForm
          {...meta}
          onSubmit={handleSubmit}
          fieldErrors={fieldErrors}
          serverError={serverError}
          loading={loading}
          onLookup={async (code) => {
            const res = await fetch(`/api/reservations/${code}`);
            return res.ok;
          }}
        />
      </div>

      {result && (
        <PackageView
          result={result}
          onBack={() => {
            setResult(null);
            window.scrollTo(0, 0);
          }}
        />
      )}
    </>
  );
}