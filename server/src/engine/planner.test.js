import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../catalog/indexes.js';
import { validateRequest } from './request.js';
import { validateTrip } from './validator.js';
import { enumerateCityPlans } from './cityplans.js';
import { planTrip } from './planner.js';
import { assignAttractions } from './schedule.js';

const catalog = buildCatalog();
const menonBody = {
  departure_airport: 'BLR', country: 'Japan', start_date: '2027-04-10',
  nights: 6, adults: 2, child_ages: [6], budget_inr: 350000,
};
const plan = (body) => planTrip(validateRequest(body, catalog).value, catalog);

test('city plans for 6 nights in Japan: 3 + 18 + 6 = 27', () => {
  const japan = catalog.countryByName.get('Japan');
  const plans = enumerateCityPlans(japan, 6, 2);
  assert.equal(plans.length, 27);
  for (const p of plans) {
    assert.equal(p.reduce((s, c) => s + c.nights, 0), 6);
    assert.ok(p.every((c) => c.nights >= 2));
    assert.equal(new Set(p.map((c) => c.city)).size, p.length); // each city once
  }
});

test('Menon request: a package that passes every rule and fits the budget', () => {
  const res = plan(menonBody);
  assert.equal(res.status, 'OK');
  assert.ok(res.total_inr <= 350000);
  assert.equal(res.balance_inr, 350000 - res.total_inr);
  const v = validateTrip(res.trip, catalog, { firstPackage: true });
  assert.deepEqual(v.errors, []);
});

test('a date outside the data window: no package, with the reason', () => {
  const res = plan({ ...menonBody, start_date: '2027-06-01' });
  assert.equal(res.status, 'NO_PACKAGE');
  assert.match(res.message, /1.*20|2027-04/);
});

test('a budget that is too small: says so and shows the cheapest total', () => {
  const ok = plan(menonBody);
  const res = plan({ ...menonBody, budget_inr: 50000 });
  assert.equal(res.status, 'OVER_BUDGET');
  assert.equal(res.cheapest_total_inr, ok.total_inr); // same cheapest package as with the big budget
  assert.equal(res.over_by_inr, ok.total_inr - 50000);
  assert.ok(res.suggestions.length >= 1);
});

test('every departure city and both countries give valid packages when flights exist', () => {
  let built = 0;
  for (const dep of ['BLR', 'DEL', 'BOM', 'MAA']) {
    for (const country of ['Japan', 'United Arab Emirates']) {
      for (const nights of [3, 7, 10]) {
        const res = plan({ ...menonBody, departure_airport: dep, country, nights, start_date: '2027-04-05', budget_inr: 9e8 });
        if (res.status !== 'OK') continue;
        built++;
        assert.deepEqual(validateTrip(res.trip, catalog, { firstPackage: true }).errors, [], `${dep} ${country} ${nights}`);
      }
    }
  }
  assert.ok(built >= 10);
});

test('attraction assignment finds a solution a greedy pick would miss', () => {
  // A can only go on day 1; B can go on day 1 or 2. Greedy "cheapest first" gives B day 1 and strands day 2... DP must not.
  const A = { id: 'A', price: 5, days: [1] };
  const B = { id: 'B', price: 1, days: [1, 2] };
  const picks = assignAttractions([1, 2], [A, B], (a, d) => a.days.includes(d), (a) => a.price);
  assert.deepEqual(picks.map((a) => a.id), ['A', 'B']);
  assert.equal(assignAttractions([1, 2], [A], (a, d) => a.days.includes(d), (a) => a.price), null);
});
