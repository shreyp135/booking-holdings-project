import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from '../catalog/indexes.js';
import { validateTrip } from './validator.js';
import { menon } from './fixtures/menon.js';

const catalog = buildCatalog();
const clone = (o) => JSON.parse(JSON.stringify(o));
const rulesOf = (trip, opts) => validateTrip(trip, catalog, opts).errors.map((e) => e.rule);
const item = (trip, id) => trip.items.find((i) => i.item_id === id);

test('the Menon fixture is valid', () => {
  const r = validateTrip(menon, catalog, { firstPackage: true });
  assert.deepEqual(r.errors, []);
  assert.equal(r.valid, true);
});

test('too few nights', () => {
  const t = clone(menon);
  t.end_date = '2027-04-11';
  assert.ok(rulesOf(t).includes('NIGHTS'));
});

test('arrival flight must land on the start date', () => {
  const t = clone(menon);
  t.start_date = '2027-04-09';
  assert.ok(rulesOf(t).includes('ARRIVAL_DATE'));
});

test('not enough seats', () => {
  const t = clone(menon);
  t.traveler.adults = 20;
  assert.ok(rulesOf(t).includes('SEATS'));
});

test('city twice / gap between hotels', () => {
  const t = clone(menon);
  item(t, 'i4').start = '2027-04-14';
  assert.ok(rulesOf(t).includes('HOTEL_GAP'));
});

test('room does not fit', () => {
  const t = clone(menon);
  item(t, 'i3').room_id = 'RM-TYO-001-A'; // a twin room, wrong hotel + too small
  const rules = rulesOf(t);
  assert.ok(rules.includes('ROOM_HOTEL'));
});

test('airport pickup too early after landing', () => {
  const t = clone(menon);
  item(t, 'i5').start = '2027-04-10T21:45'; // only 15 min after landing
  assert.ok(rulesOf(t).includes('TRANSFER_TIME'));
});

test('transfer outside service hours', () => {
  const t = clone(menon);
  item(t, 'i6').start = '2027-04-13T03:00';
  assert.ok(rulesOf(t).includes('TRANSFER_HOURS'));
});

test('missing city transfer', () => {
  const t = clone(menon);
  t.items = t.items.filter((i) => i.item_id !== 'i6');
  assert.ok(rulesOf(t).includes('CITY_TRANSFER'));
});

test('attraction outside opening hours', () => {
  const t = clone(menon);
  item(t, 'i8').start = '2027-04-11T03:00';
  assert.ok(rulesOf(t).includes('ATTRACTION_HOURS'));
});

test('attraction in the wrong city', () => {
  const t = clone(menon);
  item(t, 'i10').catalog_id = 'ATT-TYO-004'; // Tokyo attraction while in Kyoto
  assert.ok(rulesOf(t).includes('ATTRACTION_CITY'));
});

test('same attraction twice', () => {
  const t = clone(menon);
  const copy = clone(item(t, 'i8'));
  copy.item_id = 'i99';
  copy.start = '2027-04-12T10:00';
  t.items.push(copy);
  assert.ok(rulesOf(t).includes('ATTRACTION_TWICE'));
});

test('attractions on the last day are not allowed', () => {
  const t = clone(menon);
  const copy = clone(item(t, 'i11'));
  copy.item_id = 'i98';
  copy.catalog_id = 'ATT-KYO-001';
  copy.start = '2027-04-16T09:00';
  t.items.push(copy);
  assert.ok(rulesOf(t).includes('ATTRACTION_LAST_DAY'));
});

test('a full day without attractions fails only for the first package', () => {
  const t = clone(menon);
  t.items = t.items.filter((i) => i.item_id !== 'i9');
  t.total_inr = t.items.reduce((s, i) => s + i.price_inr, 0);
  assert.ok(rulesOf(t, { firstPackage: true }).includes('ATTRACTIONS_PER_DAY'));
  assert.deepEqual(rulesOf(t, { firstPackage: false }), []);
});

test('wrong price and wrong total', () => {
  const t = clone(menon);
  item(t, 'i1').price_inr = 1000;
  const rules = rulesOf(t);
  assert.ok(rules.includes('PRICE'));
  assert.ok(rules.includes('TOTAL'));
});
