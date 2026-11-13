import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../catalog/indexes.js';
import { validateRequest } from './request.js';

const catalog = buildCatalog();
const good = {
  departure_airport: 'BLR', country: 'Japan', start_date: '2027-04-10',
  nights: 6, adults: 2, child_ages: [6], budget_inr: 350000,
};

test('the Menon request is valid and gets an end date', () => {
  const r = validateRequest(good, catalog);
  assert.equal(r.ok, true);
  assert.equal(r.value.end_date, '2027-04-16');
  assert.equal(r.value.children, 1);
});

test('each bad field gives its own message', () => {
  const r = validateRequest(
    { ...good, departure_airport: 'XXX', country: 'Mars', start_date: '2027-02-30', nights: 2, adults: 0, child_ages: [18], budget_inr: -5 },
    catalog
  );
  assert.equal(r.ok, false);
  assert.deepEqual(Object.keys(r.errors).sort(),
    ['adults', 'budget_inr', 'child_ages', 'country', 'departure_airport', 'nights', 'start_date']);
});

test('a date outside the data window is still valid input', () => {
  assert.equal(validateRequest({ ...good, start_date: '2027-06-01' }, catalog).ok, true);
});
