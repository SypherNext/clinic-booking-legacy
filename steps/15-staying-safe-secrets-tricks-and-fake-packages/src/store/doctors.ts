// Every SQL statement about doctors.

import type { DatabaseSync } from 'node:sqlite';

export type Doctor = { id: number; name: string; specialty: string };

export function createDoctorStore(db: DatabaseSync) {
  return {
    list(): Doctor[] {
      return db.prepare('SELECT id, name, specialty FROM doctors ORDER BY id').all() as Doctor[];
    },

    findById(id: number): Doctor | undefined {
      return db.prepare('SELECT id, name, specialty FROM doctors WHERE id = ?').get(id) as Doctor | undefined;
    },
  };
}

export type DoctorStore = ReturnType<typeof createDoctorStore>;
