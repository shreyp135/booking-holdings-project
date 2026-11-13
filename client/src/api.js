// All backend calls go through here so components never build URLs themselves.
async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || data?.reasons?.join(' ') || `Request failed (${res.status})`);
    err.fields = data?.fields;   // per-field messages from the backend (M1)
    err.reasons = data?.reasons; // why a change was refused (M6)
    err.status = res.status;
    throw err;
  }
  return data;
}

const post = (path, body) => request(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const api = {
  destinations: () => request('/destinations'),
  plan: (body) => post('/plan', body),
  getPackage: (id) => request(`/packages/${id}`),
  options: (id) => request(`/packages/${id}/options`),
  change: (id, change) => post(`/packages/${id}/changes`, change),
  confirm: (id) => post(`/packages/${id}/confirm`),
  builderPlans: (request) => post('/builder/plans', request),
  builderCreate: (request, plan) => post('/builder/create', { ...request, plan }),
  reservation: (ref) => request(`/reservations/${ref}`),
  exportUrl: (id) => `/api/packages/${id}/export`,
};
