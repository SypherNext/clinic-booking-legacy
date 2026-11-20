import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';

const TEN = localToUtcIso(MONDAY, '10:00');

test('books an appointment', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', {
      doctorId: 1,
      startsAt: TEN,
      patientName: 'Ana Silva',
      patientPhone: '555-0142',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.patientName, 'Ana Silva');
    assert.equal(res.body.displayTime, '10:00 AM');
    assert.equal(res.body.status, 'booked');
  } finally {
    await app.close();
  }
});

test('the same slot cannot be booked twice', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' });
    const second = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ben Osei' });
    assert.equal(second.status, 409);
  } finally {
    await app.close();
  }
});

test('cancelling marks the appointment cancelled', async () => {
  const app = await startTestServer();
  try {
    const booked = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' });
    const res = await app.call('DELETE', `/api/appointments/${booked.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
  } finally {
    await app.close();
  }
});

test('missing doctorId is a 400', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', { startsAt: TEN, patientName: 'Ana Silva' });
    assert.equal(res.status, 400);
  } finally {
    await app.close();
  }
});

test('unknown doctor is a 404', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', { doctorId: 42, startsAt: TEN, patientName: 'Ana Silva' });
    assert.equal(res.status, 404);
  } finally {
    await app.close();
  }
});
