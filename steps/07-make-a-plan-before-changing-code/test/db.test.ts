import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { isUniqueViolation, openDb } from '../src/db.ts';

const INSERT =
  "INSERT INTO appointments (doctor_id, patient_name, starts_at, status, created_at) VALUES (?, ?, ?, ?, '2030-01-01T00:00:00.000Z')";

function tempDbPath() {
  const dir = mkdtempSync(join(tmpdir(), 'clinic-db-test-'));
  return { path: join(dir, 'clinic.db'), cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('opening a database with double-booked slots fails and lists them', () => {
  const { path, cleanup } = tempDbPath();
  try {
    // build a database as it could look before the unique index existed
    const old = openDb(path);
    old.exec('DROP INDEX appointments_one_booking_per_slot');
    const insert = old.prepare(INSERT);
    insert.run(1, 'Ana Silva', '2030-03-04T18:00:00.000Z', 'booked'); // id 1
    insert.run(1, 'Ben Osei', '2030-03-04T18:00:00.000Z', 'booked'); // id 2, duplicate
    insert.run(2, 'Chen Wei', '2030-03-04T18:00:00.000Z', 'booked'); // id 3, other doctor: fine
    insert.run(1, 'Dana Cruz', '2030-03-04T18:30:00.000Z', 'booked'); // id 4
    insert.run(1, 'Eli Park', '2030-03-04T18:30:00.000Z', 'cancelled'); // id 5, cancelled: fine
    old.close();

    assert.throws(
      () => openDb(path),
      (err: Error) => {
        assert.match(err.message, /more than one booked appointment/);
        assert.match(err.message, /doctor 1 at 2030-03-04T18:00:00\.000Z: appointment ids 1, 2/);
        assert.doesNotMatch(err.message, /doctor 2/);
        assert.doesNotMatch(err.message, /18:30/);
        return true;
      },
    );

    // nothing was deleted
    const raw = new DatabaseSync(path);
    const { n } = raw.prepare('SELECT COUNT(*) AS n FROM appointments').get() as { n: number };
    raw.close();
    assert.equal(n, 5);
  } finally {
    cleanup();
  }
});

test('the unique index rejects a second booked row but allows a cancelled one', () => {
  const db = openDb(':memory:');
  try {
    const insert = db.prepare(INSERT);
    insert.run(1, 'Ana Silva', '2030-03-04T18:00:00.000Z', 'booked');
    insert.run(1, 'Ben Osei', '2030-03-04T18:00:00.000Z', 'cancelled');
    let caught: unknown;
    try {
      insert.run(1, 'Chen Wei', '2030-03-04T18:00:00.000Z', 'booked');
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'expected the insert to fail');
    assert.equal(isUniqueViolation(caught), true);
    assert.equal(isUniqueViolation(new Error('something else')), false);
  } finally {
    db.close();
  }
});
