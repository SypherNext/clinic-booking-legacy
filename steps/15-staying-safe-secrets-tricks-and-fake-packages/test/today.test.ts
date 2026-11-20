// Issue 58: the pages must open on today's clinic date, not today's UTC date.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicToday } from '../src/lib/time.ts';
import { startTestServer } from './helpers.ts';

test('clinicToday is still today at 4:30 PM clinic time, when UTC is already tomorrow', () => {
  // 2030-03-04 16:30 at the clinic (UTC-8) is 2030-03-05 00:30 UTC
  assert.equal(clinicToday(new Date('2030-03-05T00:30:00.000Z')), '2030-03-04');
});

test('clinicToday in the morning', () => {
  assert.equal(clinicToday(new Date('2030-03-04T17:00:00.000Z')), '2030-03-04');
});

test('clinicToday turns over at clinic midnight', () => {
  assert.equal(clinicToday(new Date('2030-03-05T07:59:00.000Z')), '2030-03-04');
  assert.equal(clinicToday(new Date('2030-03-05T08:00:00.000Z')), '2030-03-05');
});

test('GET /api/today gives the clinic date', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/api/today');
    assert.equal(res.status, 200);
    assert.equal(res.body.date, clinicToday());
  } finally {
    await app.close();
  }
});
