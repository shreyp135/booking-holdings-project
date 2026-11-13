import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCatalog } from './indexes.js';

const c = buildCatalog();

test('catalog loads expected sizes', () => {
  assert.equal(c.raw.flights.length, 469);
  assert.equal(c.raw.hotels.length, 49);
  assert.equal(c.raw.attractions.length, 56);
});

test('indexes work', () => {
  assert.ok(c.flightsByRoute.get('BLR>NRT').length > 0);
  assert.equal(c.hotelsByCity.get('Kyoto').length, 12);
  assert.ok(c.airportByCode.get('KIX').serves_cities.includes('Kyoto'));
  assert.equal(c.availability.get('RM-TYO-001-A').get('2027-04-01'), 7);
});
