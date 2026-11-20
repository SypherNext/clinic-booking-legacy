import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MONDAY, TEST_ADMIN_TOKEN, startTestServer } from './helpers.ts';
import { readAdminToken } from '../src/config.ts';

test('readAdminToken returns ADMIN_TOKEN when it is long enough', () => {
  assert.equal(readAdminToken({ ADMIN_TOKEN: 'a'.repeat(24) }), 'a'.repeat(24));
});

test('readAdminToken rejects a missing or empty ADMIN_TOKEN', () => {
  for (const env of [{}, { ADMIN_TOKEN: '' }]) {
    const result = readAdminToken(env);
    assert.equal(typeof result, 'object');
    assert.match((result as { error: string }).error, /ADMIN_TOKEN is not set/);
  }
});

test('readAdminToken rejects a short ADMIN_TOKEN without repeating it', () => {
  const short = 'secret-value-23-chars-x';
  assert.equal(short.length, 23);
  const result = readAdminToken({ ADMIN_TOKEN: short });
  assert.equal(typeof result, 'object');
  const { error } = result as { error: string };
  assert.match(error, /at least 24 characters/);
  assert.ok(!error.includes(short));
});

const MAIN = fileURLToPath(new URL('../src/main.ts', import.meta.url));

function startMain(adminToken?: string) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.ADMIN_TOKEN;
  if (adminToken !== undefined) env.ADMIN_TOKEN = adminToken;
  return spawnSync(process.execPath, [MAIN], { env, encoding: 'utf8', timeout: 10_000 });
}

test('the server refuses to start without ADMIN_TOKEN, with a message and no stack trace', () => {
  const run = startMain();
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Not starting: ADMIN_TOKEN is not set/);
  assert.doesNotMatch(run.stderr, /\n\s+at /);
});

test('the server refuses to start with a short ADMIN_TOKEN and does not print it', () => {
  const run = startMain('too-short-token-xyz');
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Not starting: ADMIN_TOKEN is too short/);
  assert.doesNotMatch(run.stderr, /\n\s+at /);
  assert.ok(!run.stderr.includes('too-short-token-xyz'));
  assert.ok(!run.stdout.includes('too-short-token-xyz'));
});

test('the report rejects a wrong token of the same length', async () => {
  const app = await startTestServer();
  try {
    const wrong = 'x'.repeat(TEST_ADMIN_TOKEN.length);
    const res = await app.call('GET', `/admin/report?date=${MONDAY}`, undefined, { 'x-admin-token': wrong });
    assert.equal(res.status, 401);
    assert.deepEqual(res.body, { error: 'Admin token required' });
  } finally {
    await app.close();
  }
});
