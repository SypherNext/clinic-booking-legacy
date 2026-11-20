// SQLite database, using the sqlite module built into Node.js.

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS doctors (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  specialty TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS appointments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id     INTEGER NOT NULL REFERENCES doctors(id),
  patient_name  TEXT NOT NULL,
  patient_phone TEXT,
  starts_at     TEXT NOT NULL,          -- UTC ISO string
  status        TEXT NOT NULL DEFAULT 'booked',  -- booked | cancelled
  created_at    TEXT NOT NULL,
  cancelled_at  TEXT
);

-- a doctor is away for a whole clinic day; nobody can book them that day
CREATE TABLE IF NOT EXISTS days_off (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  doctor_id  INTEGER NOT NULL REFERENCES doctors(id),
  date       TEXT NOT NULL,              -- clinic date, YYYY-MM-DD
  reason     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  UNIQUE (doctor_id, date)
);
`;

const DOCTORS = [
  { id: 1, name: 'Dr. Amara Okafor', specialty: 'General practice' },
  { id: 2, name: 'Dr. Lucas Brandt', specialty: 'Pediatrics' },
  { id: 3, name: 'Dr. Mei Tanaka', specialty: 'Dermatology' },
];

// At most one booked appointment per doctor and start time. Cancelled rows are kept
// and do not count, so a cancelled slot can be booked again.
const ONE_BOOKING_PER_SLOT = `
CREATE UNIQUE INDEX IF NOT EXISTS appointments_one_booking_per_slot
  ON appointments(doctor_id, starts_at) WHERE status = 'booked'
`;

type DuplicateSlot = { doctor_id: number; starts_at: string; ids: string };

// The unique index cannot be created while a slot already has more than one booked
// appointment. We never delete data here: staff must cancel the extra bookings first.
function assertNoDoubleBookings(db: DatabaseSync, path: string): void {
  const dups = db
    .prepare(
      `SELECT doctor_id, starts_at, group_concat(id, ', ') AS ids
         FROM appointments
        WHERE status = 'booked'
        GROUP BY doctor_id, starts_at
       HAVING COUNT(*) > 1
        ORDER BY starts_at, doctor_id`,
    )
    .all() as DuplicateSlot[];
  if (dups.length === 0) return;
  const lines = dups.map((d) => `  doctor ${d.doctor_id} at ${d.starts_at}: appointment ids ${d.ids}`);
  throw new Error(
    `Database ${path} has slots with more than one booked appointment. ` +
      `Cancel the extra bookings, then start again:\n${lines.join('\n')}`,
  );
}

// True when err is SQLite refusing a write because of a UNIQUE constraint or index.
export function isUniqueViolation(err: unknown): boolean {
  const SQLITE_CONSTRAINT_UNIQUE = 2067;
  return (
    typeof err === 'object' && err !== null && (err as { errcode?: unknown }).errcode === SQLITE_CONSTRAINT_UNIQUE
  );
}

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  try {
    assertNoDoubleBookings(db, path);
  } catch (err) {
    db.close();
    throw err;
  }
  db.exec(ONE_BOOKING_PER_SLOT);
  const count = db.prepare('SELECT COUNT(*) AS n FROM doctors').get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare('INSERT INTO doctors (id, name, specialty) VALUES (?, ?, ?)');
    for (const d of DOCTORS) insert.run(d.id, d.name, d.specialty);
  }
  return db;
}
