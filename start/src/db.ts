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
`;

const DOCTORS = [
  { id: 1, name: 'Dr. Amara Okafor', specialty: 'General practice' },
  { id: 2, name: 'Dr. Lucas Brandt', specialty: 'Pediatrics' },
  { id: 3, name: 'Dr. Mei Tanaka', specialty: 'Dermatology' },
];

export function openDb(path: string): DatabaseSync {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  const count = db.prepare('SELECT COUNT(*) AS n FROM doctors').get() as { n: number };
  if (count.n === 0) {
    const insert = db.prepare('INSERT INTO doctors (id, name, specialty) VALUES (?, ?, ?)');
    for (const d of DOCTORS) insert.run(d.id, d.name, d.specialty);
  }
  return db;
}
