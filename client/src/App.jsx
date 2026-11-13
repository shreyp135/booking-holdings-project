import { useEffect, useState } from 'react';
import RequestForm from './components/RequestForm';
import { api } from './api';

export default function App() {
  const [meta, setMeta] = useState({ departureCities: [], countries: [] });
  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

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
      const data = await api.plan(request);
      if (data.status !== 'OK') setServerError(data.message);
      console.log(data);
    } catch (e) {
      setFieldErrors(e.fields || {});
      setServerError(e.fields ? '' : e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
  );
}