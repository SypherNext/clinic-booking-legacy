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

// 16:00 clinic time is 00:00 UTC the next day; it must still be reported on its own clinic day.
const TUESDAY = '2030-03-05';
const WEDNESDAY = '2030-03-06';
const admin = { 'x-admin-token': config.adminToken };

test('the report puts a 4:00 PM booking on its clinic day, not the next one', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', {
      doctorId: 1,
      startsAt: localToUtcIso(TUESDAY, '16:00'),
      patientName: 'Ben Osei',
    });
    const tue = await app.call('GET', `/admin/report?date=${TUESDAY}`, undefined, admin);
    assert.equal(tue.body.booked, 1);
    assert.equal(tue.body.appointments[0].patient, 'Ben Osei');
    assert.equal(tue.body.appointments[0].time, '4:00 PM');

    const wed = await app.call('GET', `/admin/report?date=${WEDNESDAY}`, undefined, admin);
    assert.equal(wed.body.booked, 0);
  } finally {
    await app.close();
  }
});

test('the CSV report puts a 4:00 PM booking on its clinic day, not the next one', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', {
      doctorId: 1,
      startsAt: localToUtcIso(TUESDAY, '16:00'),
      patientName: 'Ben Osei',
    });
    const tue = await app.call('GET', `/admin/report.csv?date=${TUESDAY}`, undefined, admin);
    assert.equal(tue.text, 'time,doctor,patient,phone,status\n4:00 PM,Dr. Amara Okafor,Ben Osei,,booked\n');

    const wed = await app.call('GET', `/admin/report.csv?date=${WEDNESDAY}`, undefined, admin);
    assert.equal(wed.text, 'time,doctor,patient,phone,status\n');
  } finally {
    await app.close();
  }
});
