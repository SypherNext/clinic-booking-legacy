import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MONDAY, startTestServer, type Slot } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';

const TEN = localToUtcIso(MONDAY, '10:00');
const ELEVEN = localToUtcIso(MONDAY, '11:00');
const TUESDAY = '2030-03-05';

async function book(app: Awaited<ReturnType<typeof startTestServer>>, startsAt: string, patientName = 'Ana Silva') {
  const res = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt, patientName });
  assert.equal(res.status, 201);
  return res.body;
}

async function slotAvailable(app: Awaited<ReturnType<typeof startTestServer>>, date: string, time: string) {
  const slots: Slot[] = (await app.call('GET', `/api/slots?doctorId=1&date=${date}`)).body.slots;
  return slots.find((s) => s.time === time)?.available;
}

test('moves an appointment to another day: old slot free again, new slot taken', async () => {
  const app = await startTestServer();
  try {
    const appt = await book(app, TEN);
    const to = localToUtcIso(TUESDAY, '14:30');
    const res = await app.call('PATCH', `/api/appointments/${appt.id}`, { startsAt: to });
    assert.equal(res.status, 200);
    assert.equal(res.body.id, appt.id);
    assert.equal(res.body.startsAt, to);
    assert.equal(res.body.displayTime, '2:30 PM');
    assert.equal(res.body.status, 'booked');

    assert.equal(await slotAvailable(app, MONDAY, '10:00'), true);
    assert.equal(await slotAvailable(app, TUESDAY, '14:30'), false);

    // the old slot can be booked by someone else now
    await book(app, TEN, 'Ben Osei');

    const lines = (await readFile(app.auditLogPath, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    const entry = lines.find((l) => l.event === 'reschedule');
    assert.deepEqual({ id: entry.id, from: entry.from, to: entry.to }, { id: appt.id, from: TEN, to });
  } finally {
    await app.close();
  }
});

test('moving an unknown appointment is a 404', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('PATCH', '/api/appointments/999', { startsAt: TEN });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Appointment not found' });
  } finally {
    await app.close();
  }
});

test('a cancelled appointment cannot be moved', async () => {
  const app = await startTestServer();
  try {
    const appt = await book(app, TEN);
    await app.call('DELETE', `/api/appointments/${appt.id}`);
    const res = await app.call('PATCH', `/api/appointments/${appt.id}`, { startsAt: ELEVEN });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Only booked appointments can be moved' });
  } finally {
    await app.close();
  }
});

test('moving onto a slot someone else has booked is a 409', async () => {
  const app = await startTestServer();
  try {
    const appt = await book(app, TEN);
    await book(app, ELEVEN, 'Ben Osei');
    const res = await app.call('PATCH', `/api/appointments/${appt.id}`, { startsAt: ELEVEN });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'That slot is already taken' });
    const still = await app.call('GET', `/api/appointments/${appt.id}`);
    assert.equal(still.body.startsAt, TEN);
  } finally {
    await app.close();
  }
});

test('moving to an off-grid time is a 400', async () => {
  const app = await startTestServer();
  try {
    const appt = await book(app, TEN);
    const res = await app.call('PATCH', `/api/appointments/${appt.id}`, { startsAt: localToUtcIso(MONDAY, '10:07') });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'startsAt is not an open slot' });
    const still = await app.call('GET', `/api/appointments/${appt.id}`);
    assert.equal(still.body.startsAt, TEN);
  } finally {
    await app.close();
  }
});

test('moving to the time it already has changes nothing', async () => {
  const app = await startTestServer();
  try {
    const appt = await book(app, TEN);
    const res = await app.call('PATCH', `/api/appointments/${appt.id}`, { startsAt: TEN });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, appt);
    assert.equal(await slotAvailable(app, MONDAY, '10:00'), false);
    const lines = (await readFile(app.auditLogPath, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.filter((l) => l.event === 'reschedule').length, 0);
  } finally {
    await app.close();
  }
});
