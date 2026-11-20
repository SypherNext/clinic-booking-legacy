import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';
import { config } from '../src/config.ts';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDb } from '../src/db.ts';
import { createAppointmentStore } from '../src/store/appointments.ts';

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

test('the CSV report needs the admin token', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/admin/report.csv?date=${MONDAY}`);
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Admin token required' });
  } finally {
    await app.close();
  }
});

// 12:00 is in the lunch break and can no longer be booked, but bookings made before
// the break was added are kept, so this one goes into the database through the store.
test('the report shows a noon booking as 12:00 PM', async () => {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'clinic-test-')), 'clinic.db');
  const db = openDb(dbPath);
  createAppointmentStore(db).insert({
    doctorId: 1,
    startsAt: localToUtcIso(MONDAY, '12:00'),
    patientName: 'Ana Silva',
    patientPhone: null,
  });
  db.close();
  const app = await startTestServer(dbPath);
  try {
    const res = await app.call('GET', `/admin/report?date=${MONDAY}`, undefined, admin);
    assert.equal(res.body.appointments[0].time, '12:00 PM');
  } finally {
    await app.close();
  }
});

// The report used to accept 2030-02-30 and quietly show 2030-03-02 instead.
// It now checks dates with isValidDate, like the rest of the API.
for (const path of ['/admin/report', '/admin/report.csv']) {
  test(`${path} with an impossible date (2030-02-30) is a 400`, async () => {
    const app = await startTestServer();
    try {
      const res = await app.call('GET', `${path}?date=2030-02-30`, undefined, admin);
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'date (YYYY-MM-DD) is required' });
    } finally {
      await app.close();
    }
  });
}

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
