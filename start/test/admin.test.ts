import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';
import { config } from '../src/config.ts';

test('the report needs the admin token', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/admin/report?date=${MONDAY}`);
    assert.equal(res.status, 401);
  } finally {
    await app.close();
  }
});

test('the report lists the day', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', {
      doctorId: 2,
      startsAt: localToUtcIso(MONDAY, '11:30'),
      patientName: 'Chen Wei',
    });
    const res = await app.call('GET', `/admin/report?date=${MONDAY}`, undefined, { 'x-admin-token': config.adminToken });
    assert.equal(res.status, 200);
    assert.equal(res.body.booked, 1);
    assert.equal(res.body.appointments[0].time, '11:30 AM');
    assert.equal(res.body.appointments[0].doctor, 'Dr. Lucas Brandt');
  } finally {
    await app.close();
  }
});
