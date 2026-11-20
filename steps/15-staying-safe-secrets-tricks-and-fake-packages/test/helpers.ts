// Starts a fresh server on a random port, with an in-memory database unless dbPath is given.

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createServer } from '../src/server.ts';

// Test-only front desk token; the real one comes from ADMIN_TOKEN and is never used in tests.
export const TEST_ADMIN_TOKEN = 'test-only-admin-token-not-for-production';

export async function startTestServer(dbPath = ':memory:') {
  const dir = mkdtempSync(join(tmpdir(), 'clinic-test-'));
  const auditLogPath = join(dir, 'audit.log');
  const server = createServer({ dbPath, auditLogPath, adminToken: TEST_ADMIN_TOKEN });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(base + path, {
      method,
      headers: { 'content-type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    // tests read many different response shapes, so the parsed body is left untyped
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: res.status, body: json, text };
  }

  return {
    base,
    call,
    auditLogPath,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export type Slot = { time: string; startsAt: string; available: boolean };

// a Monday far in the future, so tests never book in the past
export const MONDAY = '2030-03-04';
export const SUNDAY = '2030-03-10';
