// Fills the database with a few demo appointments so the pages have something to show.
// Usage: npm run seed -- 2030-03-04     (books that day; default is the next weekday)

import { isUniqueViolation, openDb } from '../src/db.ts';
import { config } from '../src/config.ts';
import { isOpenDay } from '../src/lib/schedule.ts';
import { addDays, localToUtcIso } from '../src/lib/time.ts';

function nextWorkingDay(): string {
  let date = new Date().toISOString().slice(0, 10);
  do {
    date = addDays(date, 1);
  } while (!isOpenDay(date));
  return date;
}

const DEMO = [
  { doctorId: 1, time: '09:00', patient: 'Ana Silva', phone: '555-0142' },
  { doctorId: 1, time: '10:30', patient: 'Ben Osei', phone: '555-0177' },
  { doctorId: 1, time: '14:00', patient: 'Chen Wei', phone: null },
  { doctorId: 2, time: '09:30', patient: 'Dana Cruz', phone: '555-0110' },
  { doctorId: 3, time: '11:00', patient: 'Eli Park', phone: '555-0199' },
];

const date = process.argv[2] || nextWorkingDay();
if (!isOpenDay(date)) {
  console.error(`${date} is a closed day, pick another date`);
  process.exit(1);
}

const db = openDb(config.dbPath);
const insert = db.prepare(
  "INSERT INTO appointments (doctor_id, patient_name, patient_phone, starts_at, status, created_at) VALUES (?, ?, ?, ?, 'booked', ?)",
);
const now = new Date().toISOString();
let added = 0;
let skipped = 0;
for (const a of DEMO) {
  try {
    insert.run(a.doctorId, a.patient, a.phone, localToUtcIso(date, a.time), now);
    added++;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    skipped++; // that slot is already booked
  }
}
db.close();
console.log(`Added ${added} demo appointments on ${date} to ${config.dbPath}`);
if (skipped > 0) console.log(`Skipped ${skipped} demo slots that were already booked`);
