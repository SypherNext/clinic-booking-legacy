import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, SUNDAY, startTestServer, type Slot } from './helpers.ts';

test('a Monday has 16 free slots', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/api/slots?doctorId=1&date=${MONDAY}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.closed, false);
    assert.equal(res.body.slots.length, 16);
    assert.ok(res.body.slots.every((s: Slot) => s.available));
  } finally {
    await app.close();
  }
});

test('the clinic is closed on Sunday', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/api/slots?doctorId=1&date=${SUNDAY}`);
    assert.equal(res.body.closed, true);
    assert.deepEqual(res.body.slots, []);
  } finally {
    await app.close();
  }
});

test('a booked morning slot is no longer available', async () => {
  const app = await startTestServer();
  try {
    const slots = (await app.call('GET', `/api/slots?doctorId=1&date=${MONDAY}`)).body.slots;
    const nine = slots.find((s: Slot) => s.time === '09:00');
    await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: nine.startsAt, patientName: 'Ana Silva' });
    const after = (await app.call('GET', `/api/slots?doctorId=1&date=${MONDAY}`)).body.slots;
    assert.equal(after.find((s: Slot) => s.time === '09:00')?.available, false);
  } finally {
    await app.close();
  }
});

test('a bad date is rejected', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/api/slots?doctorId=1&date=tomorrow');
    assert.equal(res.status, 400);
  } finally {
    await app.close();
  }
});
