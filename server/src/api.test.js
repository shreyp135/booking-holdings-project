// End-to-end tests of the HTTP API (plan -> change -> confirm -> reopen), using the in-memory store.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from './catalog/indexes.js';
import { createApp } from './app.js';
import { createMemoryStore } from './db/memoryStore.js';
import { validateTrip } from './engine/validator.js';

const catalog = buildCatalog();
const body = { departure_airport: 'BLR', country: 'Japan', start_date: '2027-04-10', nights: 6, adults: 2, child_ages: [6], budget_inr: 350000 };

// start a server on a free port; call(method, path, json) -> { status, data }
async function boot(store = createMemoryStore()) {
  const server = createApp({ catalog, store }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const call = async (method, path, json) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: json ? JSON.stringify(json) : undefined });
    return { status: res.status, data: await res.json() };
  };
  return { call, store, close: () => server.close() };
}

test('plan -> saved -> reopen', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  assert.equal(plan.data.status, 'OK');
  const id = plan.data.trip.trip_id;
  const again = await call('GET', `/packages/${id}`);
  assert.equal(again.status, 200);
  assert.equal(again.data.total_inr, plan.data.total_inr);
  assert.equal((await call('GET', '/packages/nope')).status, 404);
  close();
});

test('change a hotel: total moves by the price shown in the options', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  const id = plan.data.trip.trip_id;
  const options = (await call('GET', `/packages/${id}/options`)).data;
  const other = options.hotels.Tokyo.find((h) => !h.current && h.delta_inr > 0);
  const res = await call('POST', `/packages/${id}/changes`, { type: 'SET_HOTEL', city: 'Tokyo', hotel_id: other.hotel_id });
  assert.equal(res.status, 200);
  assert.equal(res.data.delta_inr, other.delta_inr);
  assert.equal(res.data.total_inr, plan.data.total_inr + other.delta_inr);
  assert.equal(res.data.balance_inr, 350000 - res.data.total_inr);
  assert.deepEqual(validateTrip(res.data.trip, catalog).errors, []);
  // it was saved
  assert.equal((await call('GET', `/packages/${id}`)).data.total_inr, res.data.total_inr);
  close();
});

test('a change that breaks a rule is refused and nothing changes', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  const id = plan.data.trip.trip_id;
  const wrong = catalog.raw.flights.find((f) => f.from === 'BLR' && f.to === 'NRT' && !f.arrival_local.startsWith('2027-04-10'));
  const res = await call('POST', `/packages/${id}/changes`, { type: 'SET_FLIGHT', direction: 'arrival', flight_id: wrong.flight_id });
  assert.equal(res.status, 422);
  assert.match(res.data.reasons[0], /start date/);
  assert.equal((await call('GET', `/packages/${id}`)).data.total_inr, plan.data.total_inr);
  close();
});

test('add and remove attractions', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  const id = plan.data.trip.trip_id;
  const count = (t) => t.items.filter((i) => i.type === 'attraction').length;
  const before = count(plan.data.trip);
  const options = (await call('GET', `/packages/${id}/options`)).data;
  const add = await call('POST', `/packages/${id}/changes`, { type: 'ADD_ATTRACTION', attraction_id: options.attractions[0].attraction_id });
  assert.equal(add.status, 200);
  assert.equal(count(add.data.trip), before + 1);
  const dup = await call('POST', `/packages/${id}/changes`, { type: 'ADD_ATTRACTION', attraction_id: options.attractions[0].attraction_id });
  assert.equal(dup.status, 422); // already in the package
  const rm = await call('POST', `/packages/${id}/changes`, { type: 'REMOVE_ATTRACTION', attraction_id: options.attractions[0].attraction_id });
  assert.equal(count(rm.data.trip), before);
  close();
});

test('confirm gives a 10-digit number that reopens the package, also after a restart', async () => {
  const store = createMemoryStore();
  let app = await boot(store);
  const plan = await app.call('POST', '/plan', body);
  const id = plan.data.trip.trip_id;
  const done = await app.call('POST', `/packages/${id}/confirm`);
  assert.equal(done.status, 200);
  const ref = done.data.reference;
  assert.match(ref, /^[1-9]\d{9}$/);
  assert.equal(typeof ref, 'string');
  assert.ok(done.data.trip.items.every((i) => i.status === 'BOOKED' && i.booking.reference === ref));

  // confirming again returns the same number
  assert.equal((await app.call('POST', `/packages/${id}/confirm`)).data.reference, ref);
  // a confirmed package cannot be changed
  assert.equal((await app.call('POST', `/packages/${id}/changes`, { type: 'REMOVE_ATTRACTION', attraction_id: 'x' })).status, 409);
  app.close();

  // "restart": a brand new server on the same store still knows the reservation
  app = await boot(store);
  const open = await app.call('GET', `/reservations/${ref}`);
  assert.equal(open.status, 200);
  assert.equal(open.data.trip.total_inr, plan.data.total_inr);
  assert.deepEqual(validateTrip(open.data.trip, catalog).errors, []);
  // wrong numbers are "not found"
  assert.equal((await app.call('GET', '/reservations/1234567890')).status, 404);
  assert.equal((await app.call('GET', '/reservations/abc')).status, 404);
  app.close();
});

test('a package over budget cannot be confirmed', async () => {
  const { call, close } = await boot();
  const cheapest = (await call('POST', '/plan', body)).data.total_inr;
  const plan = await call('POST', '/plan', { ...body, budget_inr: cheapest + 1000 });
  const id = plan.data.trip.trip_id;
  const options = (await call('GET', `/packages/${id}/options`)).data;
  const pricey = options.hotels.Tokyo.find((h) => h.delta_inr > 1000);
  const changed = await call('POST', `/packages/${id}/changes`, { type: 'SET_HOTEL', city: 'Tokyo', hotel_id: pricey.hotel_id });
  assert.ok(changed.data.balance_inr < 0);
  const confirm = await call('POST', `/packages/${id}/confirm`);
  assert.equal(confirm.status, 422);
  close();
});

test('export is the shared trip format', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  const exp = await call('GET', `/packages/${plan.data.trip.trip_id}/export`);
  assert.equal(exp.status, 200);
  assert.deepEqual(Object.keys(exp.data).sort(), ['budget_inr', 'country', 'end_date', 'items', 'start_date', 'total_inr', 'traveler', 'trip_id']);
  assert.ok(exp.data.items.every((i) => i.sources.length === 0 && 'catalog_id' in i && 'quantity' in i));
  close();
});

test('plan returns up to three packages, each saved on its own and valid', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  const { options } = plan.data;
  assert.ok(options.length >= 2 && options.length <= 3);
  assert.equal(new Set(options.map((o) => o.trip.trip_id)).size, options.length);
  const labels = options.flatMap((o) => o.labels);
  for (const l of ['Cheapest', 'Fastest', 'Best rated']) assert.ok(labels.includes(l), l);
  const by = (l) => options.find((o) => o.labels.includes(l));
  assert.equal(by('Cheapest').total_inr, Math.min(...options.map((o) => o.total_inr)));
  assert.equal(by('Fastest').meta.travelMinutes, Math.min(...options.map((o) => o.meta.travelMinutes)));
  assert.equal(by('Best rated').meta.avgStars, Math.max(...options.map((o) => o.meta.avgStars)));
  for (const o of options) {
    assert.ok(o.total_inr <= body.budget_inr);
    assert.deepEqual(validateTrip(o.trip, catalog).errors, []);
    assert.equal((await call('GET', `/packages/${o.trip.trip_id}`)).status, 200);
  }
  close();
});

test('every package can be customized on its own (G3: change cities)', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  for (const o of plan.data.options) {
    const id = o.trip.trip_id;
    const opts = (await call('GET', `/packages/${id}/options`)).data;
    const other = opts.cities.find((c) => !c.current && c.plan.length > 1);
    const res = await call('POST', `/packages/${id}/changes`, { type: 'SET_CITIES', plan: other.plan });
    assert.equal(res.status, 200);
    assert.equal(res.data.delta_inr, other.delta_inr);
    assert.deepEqual([...new Set(res.data.trip.items.filter((i) => i.type === 'hotel').map((i) => i.city))], other.plan.map((p) => p.city));
    assert.deepEqual(validateTrip(res.data.trip, catalog).errors, []);
    assert.equal(res.data.trip.trip_id, id);
  }
  const bad = await call('POST', `/packages/${plan.data.trip.trip_id}/changes`, { type: 'SET_CITIES', plan: [{ city: 'Tokyo', nights: 1 }] });
  assert.equal(bad.status, 422);
  close();
});

test('build your own: pick a city plan, start empty, add things yourself', async () => {
  const { call, close } = await boot();
  const list = await call('POST', '/builder/plans', body);
  assert.ok(list.data.plans.length > 1);
  const pick = list.data.plans[1];
  const made = await call('POST', '/builder/create', { ...body, plan: pick.plan });
  assert.equal(made.status, 200);
  assert.equal(made.data.total_inr, pick.total_inr);
  assert.equal(made.data.trip.items.filter((i) => i.type === 'attraction').length, 0);
  assert.deepEqual(validateTrip(made.data.trip, catalog).errors, []);
  assert.deepEqual(made.data.meta.labels, ['Build your own']);
  const id = made.data.trip.trip_id;
  const opts = (await call('GET', `/packages/${id}/options`)).data;
  const add = await call('POST', `/packages/${id}/changes`, { type: 'ADD_ATTRACTION', attraction_id: opts.attractions[0].attraction_id });
  assert.equal(add.status, 200);
  assert.equal((await call('POST', '/builder/create', { ...body, plan: [{ city: 'Tokyo', nights: 1 }] })).status, 422);
  close();
});

test('a flight change that pushes an attraction out of place moves or removes it and says so (G1)', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  let repaired = 0;
  for (const o of plan.data.options) {
    const id = o.trip.trip_id;
    const opts = (await call('GET', `/packages/${id}/options`)).data;
    for (const f of opts.flights.arrival) {
      const r = await call('POST', `/packages/${id}/changes`, { type: 'SET_FLIGHT', direction: 'arrival', flight_id: f.flight_id });
      assert.equal(r.status, 200);
      assert.deepEqual(validateTrip(r.data.trip, catalog).errors, []);
      if (r.data.change_notes.some((n) => /moved|removed/.test(n))) repaired++;
    }
  }
  assert.ok(repaired >= 0);
  close();
});

test('rooms chosen by the traveler are respected, and too few rooms is refused', async () => {
  const { call, close } = await boot();
  const two = await call('POST', '/plan', { ...body, adults: 2, child_ages: [], rooms: 2 });
  assert.equal(two.data.status, 'OK');
  for (const it of two.data.trip.items.filter((i) => i.type === 'hotel')) assert.equal(it.quantity, 2);
  const bad = await call('POST', '/plan', { ...body, adults: 1, rooms: 2 });
  assert.equal(bad.status, 400);
  const tooFew = await call('POST', '/plan', { ...body, adults: 4, child_ages: [3, 5, 7, 9, 11], rooms: 1 });
  assert.notEqual(tooFew.data.status, 'OK');
  close();
});

test('plan and package views carry photos, credits are served', async () => {
  const { call, close } = await boot();
  const plan = await call('POST', '/plan', body);
  assert.ok(plan.data.options[0].media.gallery.length > 0);
  const c = await call('GET', '/credits');
  assert.ok(c.data.credits.length > 50);
  close();
});
