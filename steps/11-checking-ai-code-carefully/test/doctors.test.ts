import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.ts';

test('lists the three seeded doctors', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/api/doctors');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 3);
    assert.equal(res.body[0].name, 'Dr. Amara Okafor');
  } finally {
    await app.close();
  }
});

test('unknown doctor is 404', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/api/doctors/99');
    assert.equal(res.status, 404);
  } finally {
    await app.close();
  }
});
