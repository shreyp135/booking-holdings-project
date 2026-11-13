async function request(path, options) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.fields = data?.fields; // per-field messages from the backend (M1)
    throw err;
  }
  return data;
}

export const api = {
  destinations: () => request('/destinations'),
  plan: (body) => request('/plan', { method: 'POST', body: JSON.stringify(body) }),   // <- new
  validateRequest: (body) => request('/requests/validate', { method: 'POST', body: JSON.stringify(body) }),
};
