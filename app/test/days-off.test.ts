import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { MONDAY, SUNDAY, TEST_ADMIN_TOKEN, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';

const WEDNESDAY = '2030-03-06';
const admin = { 'x-admin-token': TEST_ADMIN_TOKEN };

type App = Awaited<ReturnType<typeof startTestServer>>;

function addDayOff(app: App, body: unknown) {
  return app.call('POST', '/admin/days-off', body, admin);
}

async function auditLines(app: App) {
  return (await readFile(app.auditLogPath, 'utf8')).trim().split('\n').map((l) => JSON.parse(l));
}

test('adding, listing and removing days off needs the admin token', async () => {
  const app = await startTestServer();
  try {
    for (const [method, path, body] of [
      ['POST', '/admin/days-off', { doctorId: 3, date: WEDNESDAY }],
      ['GET', '/admin/days-off', undefined],
      ['DELETE', '/admin/days-off/1', undefined],
    ] as const) {
      const res = await app.call(method, path, body);
      assert.equal(res.status, 401, `${method} ${path}`);
      assert.deepEqual(res.body, { error: 'Admin token required' });
    }
    const wrong = await app.call('GET', '/admin/days-off', undefined, { 'x-admin-token': 'wrong' });
    assert.equal(wrong.status, 401);
  } finally {
    await app.close();
  }
});

test('POST /admin/days-off adds a day off and writes an audit entry', async () => {
  const app = await startTestServer();
  try {
    const res = await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason: 'Conference' });
    assert.equal(res.status, 201);
    assert.deepEqual(res.body, { id: res.body.id, doctorId: 3, date: WEDNESDAY, reason: 'Conference' });
    assert.equal(typeof res.body.id, 'number');

    const entry = (await auditLines(app)).find((l) => l.event === 'day-off-added');
    assert.deepEqual({ id: entry.id, doctorId: entry.doctorId, date: entry.date }, { id: res.body.id, doctorId: 3, date: WEDNESDAY });
  } finally {
    await app.close();
  }
});

test('reason is optional and defaults to an empty string', async () => {
  const app = await startTestServer();
  try {
    const res = await addDayOff(app, { doctorId: 3, date: WEDNESDAY });
    assert.equal(res.status, 201);
    assert.equal(res.body.reason, '');
  } finally {
    await app.close();
  }
});

for (const date of [undefined, 'tomorrow', '2030-3-6', '2030-02-30']) {
  test(`a day off with date ${JSON.stringify(date)} is a 400`, async () => {
    const app = await startTestServer();
    try {
      const res = await addDayOff(app, { doctorId: 3, date });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'date (YYYY-MM-DD) is required' });
    } finally {
      await app.close();
    }
  });
}

test('a reason of 100 characters is fine, 101 is a 400', async () => {
  const app = await startTestServer();
  try {
    const long = await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason: 'x'.repeat(101) });
    assert.equal(long.status, 400);
    assert.deepEqual(long.body, { error: 'reason must be 100 characters or fewer' });

    const ok = await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason: 'x'.repeat(100) });
    assert.equal(ok.status, 201);
  } finally {
    await app.close();
  }
});

for (const reason of [42, true, ['Conference'], { text: 'Conference' }]) {
  test(`a reason of ${JSON.stringify(reason)} is a 400`, async () => {
    const app = await startTestServer();
    try {
      const res = await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'reason must be text' });
    } finally {
      await app.close();
    }
  });
}

test('a date in the past is a 400; today is fine', async () => {
  // 10:00 on Thursday 2030-03-07 at the clinic
  const app = await startTestServer(':memory:', { now: () => new Date(localToUtcIso('2030-03-07', '10:00')) });
  try {
    const past = await addDayOff(app, { doctorId: 3, date: WEDNESDAY });
    assert.equal(past.status, 400);
    assert.deepEqual(past.body, { error: 'date is in the past' });

    const today = await addDayOff(app, { doctorId: 3, date: '2030-03-07' });
    assert.equal(today.status, 201);
  } finally {
    await app.close();
  }
});

test('a day the clinic is closed is a 400', async () => {
  const app = await startTestServer();
  try {
    const res = await addDayOff(app, { doctorId: 3, date: SUNDAY });
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'The clinic is closed on that day' });
  } finally {
    await app.close();
  }
});

test('an unknown doctor is a 404', async () => {
  const app = await startTestServer();
  try {
    const res = await addDayOff(app, { doctorId: 99, date: WEDNESDAY });
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Doctor not found' });
  } finally {
    await app.close();
  }
});

test('the same doctor and day twice is a 409', async () => {
  const app = await startTestServer();
  try {
    assert.equal((await addDayOff(app, { doctorId: 3, date: WEDNESDAY })).status, 201);
    const again = await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason: 'again' });
    assert.equal(again.status, 409);
    assert.deepEqual(again.body, { error: 'Already marked away on that day' });
  } finally {
    await app.close();
  }
});

test('a day with a booked appointment is a 409 and the appointment is kept', async () => {
  const app = await startTestServer();
  try {
    // 16:00 clinic time is already the next day in UTC; it still counts for its clinic day
    const booked = await app.call('POST', '/api/appointments', {
      doctorId: 3,
      startsAt: localToUtcIso(WEDNESDAY, '16:00'),
      patientName: 'Ana Silva',
    });
    assert.equal(booked.status, 201);

    const res = await addDayOff(app, { doctorId: 3, date: WEDNESDAY });
    assert.equal(res.status, 409);
    assert.deepEqual(res.body, { error: 'Doctor has booked appointments that day; move or cancel them first' });

    const appt = await app.call('GET', `/api/appointments/${booked.body.id}`);
    assert.equal(appt.body.status, 'booked');
  } finally {
    await app.close();
  }
});

test('a 4:00 PM booking the clinic day before does not block the day off', async () => {
  const app = await startTestServer();
  try {
    const booked = await app.call('POST', '/api/appointments', {
      doctorId: 3,
      startsAt: localToUtcIso('2030-03-05', '16:00'),
      patientName: 'Ana Silva',
    });
    assert.equal(booked.status, 201);
    assert.equal((await addDayOff(app, { doctorId: 3, date: WEDNESDAY })).status, 201);
  } finally {
    await app.close();
  }
});

test('cancelled appointments and other doctors do not block the day off', async () => {
  const app = await startTestServer();
  try {
    const startsAt = localToUtcIso(WEDNESDAY, '10:00');
    const mine = await app.call('POST', '/api/appointments', { doctorId: 3, startsAt, patientName: 'Ana Silva' });
    await app.call('DELETE', `/api/appointments/${mine.body.id}`);
    await app.call('POST', '/api/appointments', { doctorId: 1, startsAt, patientName: 'Ben Osei' });

    assert.equal((await addDayOff(app, { doctorId: 3, date: WEDNESDAY })).status, 201);
  } finally {
    await app.close();
  }
});

test('GET /admin/days-off lists days off on or after from, sorted by date', async () => {
  const app = await startTestServer();
  try {
    await addDayOff(app, { doctorId: 1, date: '2030-03-08' });
    await addDayOff(app, { doctorId: 2, date: MONDAY });
    await addDayOff(app, { doctorId: 3, date: WEDNESDAY, reason: 'Conference' });

    const res = await app.call('GET', `/admin/days-off?from=${WEDNESDAY}`, undefined, admin);
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.map((d: { doctorId: number; date: string; reason: string }) => [d.doctorId, d.date, d.reason]),
      [
        [3, WEDNESDAY, 'Conference'],
        [1, '2030-03-08', ''],
      ],
    );
  } finally {
    await app.close();
  }
});

test('GET /admin/days-off without from starts at today\'s clinic date', async () => {
  // 17:00 on Tuesday 2030-03-05 at the clinic is already Wednesday in UTC
  let now = new Date(localToUtcIso(MONDAY, '10:00'));
  const app = await startTestServer(':memory:', { now: () => now });
  try {
    await addDayOff(app, { doctorId: 1, date: '2030-03-05' });
    await addDayOff(app, { doctorId: 2, date: WEDNESDAY });
    now = new Date(localToUtcIso('2030-03-05', '17:00'));

    const res = await app.call('GET', '/admin/days-off', undefined, admin);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.map((d: { date: string }) => d.date), ['2030-03-05', WEDNESDAY]);
  } finally {
    await app.close();
  }
});

test('GET /admin/days-off with a bad from is a 400', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/admin/days-off?from=2030-02-30', undefined, admin);
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { error: 'date (YYYY-MM-DD) is required' });
  } finally {
    await app.close();
  }
});

test('DELETE /admin/days-off/:id removes it and writes an audit entry', async () => {
  const app = await startTestServer();
  try {
    const added = await addDayOff(app, { doctorId: 3, date: WEDNESDAY });
    const res = await app.call('DELETE', `/admin/days-off/${added.body.id}`, undefined, admin);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, added.body);

    const list = await app.call('GET', `/admin/days-off?from=${MONDAY}`, undefined, admin);
    assert.deepEqual(list.body, []);

    const entry = (await auditLines(app)).find((l) => l.event === 'day-off-removed');
    assert.deepEqual({ id: entry.id, doctorId: entry.doctorId, date: entry.date }, { id: added.body.id, doctorId: 3, date: WEDNESDAY });
  } finally {
    await app.close();
  }
});

test('DELETE /admin/days-off/:id for an unknown id is a 404', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('DELETE', '/admin/days-off/999', undefined, admin);
    assert.equal(res.status, 404);
    assert.deepEqual(res.body, { error: 'Day off not found' });
  } finally {
    await app.close();
  }
});
