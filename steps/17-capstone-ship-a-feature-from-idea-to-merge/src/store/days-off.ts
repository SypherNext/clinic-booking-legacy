// Every SQL statement about doctors' days off.
// A day off is a whole clinic day, stored as its clinic date (YYYY-MM-DD), not a UTC time.

import type { DatabaseSync } from 'node:sqlite';
import { isUniqueViolation } from '../db.ts';

export type DayOffRow = {
  id: number;
  doctor_id: number;
  date: string;
  reason: string;
  created_at: string;
};

export function createDaysOffStore(db: DatabaseSync) {
  function findById(id: number): DayOffRow | undefined {
    return db.prepare('SELECT * FROM days_off WHERE id = ?').get(id) as DayOffRow | undefined;
  }

  return {
    findById,

    // Adds a day off. Returns the new row, or null when the doctor is already away that day.
    add(doctorId: number, date: string, reason: string): DayOffRow | null {
      const now = new Date().toISOString();
      try {
        const result = db
          .prepare('INSERT INTO days_off (doctor_id, date, reason, created_at) VALUES (?, ?, ?, ?)')
          .run(doctorId, date, reason, now);
        return findById(Number(result.lastInsertRowid)) as DayOffRow;
      } catch (err) {
        if (isUniqueViolation(err)) return null;
        throw err;
      }
    },

    // days off on or after the clinic date `from`, sorted by date
    list(from: string): DayOffRow[] {
      return db
        .prepare('SELECT * FROM days_off WHERE date >= ? ORDER BY date, doctor_id')
        .all(from) as DayOffRow[];
    },

    isAway(doctorId: number, date: string): boolean {
      return db.prepare('SELECT 1 FROM days_off WHERE doctor_id = ? AND date = ?').get(doctorId, date) !== undefined;
    },

    // Deletes one day off. Returns false when there was none with that id.
    remove(id: number): boolean {
      return Number(db.prepare('DELETE FROM days_off WHERE id = ?').run(id).changes) > 0;
    },
  };
}

export type DaysOffStore = ReturnType<typeof createDaysOffStore>;
