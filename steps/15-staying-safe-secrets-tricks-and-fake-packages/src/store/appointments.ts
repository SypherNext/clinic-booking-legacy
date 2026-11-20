// Every SQL statement about appointments.
// Times go in and come out as UTC ISO strings; days are clinic days (see clinicDayUtcRange).

import type { DatabaseSync } from 'node:sqlite';
import { isUniqueViolation } from '../db.ts';
import { clinicDayUtcRange } from '../lib/time.ts';

export type AppointmentRow = {
  id: number;
  doctor_id: number;
  patient_name: string;
  patient_phone: string | null;
  starts_at: string;
  status: string;
  created_at: string;
  cancelled_at: string | null;
};

export type ReportRow = {
  id: number;
  starts_at: string;
  patient_name: string;
  patient_phone: string | null;
  status: string;
  doctor: string;
};

export type NewAppointment = {
  doctorId: number;
  patientName: string;
  patientPhone: string | null;
  startsAt: string;
};

export function createAppointmentStore(db: DatabaseSync) {
  function findById(id: number): AppointmentRow | undefined {
    return db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as AppointmentRow | undefined;
  }

  // Claims a doctor's slot by running `write` (an INSERT or UPDATE) when no other booked
  // appointment holds it. Returns null when the slot is taken. `write` runs straight after
  // the check, with no await in between; the unique index appointments_one_booking_per_slot
  // catches anything that still slips through. `exceptId` is the appointment being moved.
  function claimSlot<T>(doctorId: number, startsAt: string, write: () => T, exceptId = -1): T | null {
    const clash = db
      .prepare("SELECT id FROM appointments WHERE doctor_id = ? AND starts_at = ? AND status = 'booked' AND id != ?")
      .get(doctorId, startsAt, exceptId);
    if (clash) return null;
    try {
      return write();
    } catch (err) {
      if (isUniqueViolation(err)) return null;
      throw err;
    }
  }

  return {
    findById,

    // one doctor's appointments on a clinic day, booked and cancelled
    listDoctorDay(doctorId: number, date: string): AppointmentRow[] {
      const day = clinicDayUtcRange(date);
      return db
        .prepare('SELECT * FROM appointments WHERE doctor_id = ? AND starts_at >= ? AND starts_at < ? ORDER BY starts_at')
        .all(doctorId, day.start, day.end) as AppointmentRow[];
    },

    // every doctor's appointments on a clinic day, with the doctor's name, for the front desk report
    listDayForReport(date: string): ReportRow[] {
      const day = clinicDayUtcRange(date);
      return db
        .prepare(
          `SELECT a.id, a.starts_at, a.patient_name, a.patient_phone, a.status, d.name AS doctor
           FROM appointments a JOIN doctors d ON d.id = a.doctor_id
           WHERE a.starts_at >= ? AND a.starts_at < ?
           ORDER BY a.starts_at, d.name`,
        )
        .all(day.start, day.end) as ReportRow[];
    },

    // start times already booked for one doctor on a clinic day
    bookedStartTimes(doctorId: number, date: string): Set<string> {
      const day = clinicDayUtcRange(date);
      const rows = db
        .prepare(
          "SELECT starts_at FROM appointments WHERE doctor_id = ? AND status = 'booked' AND starts_at >= ? AND starts_at < ?",
        )
        .all(doctorId, day.start, day.end) as { starts_at: string }[];
      return new Set(rows.map((r) => r.starts_at));
    },

    // Books the slot. Returns the new appointment, or null when the slot is taken.
    insert(a: NewAppointment): AppointmentRow | null {
      const now = new Date().toISOString();
      const result = claimSlot(a.doctorId, a.startsAt, () =>
        db
          .prepare(
            'INSERT INTO appointments (doctor_id, patient_name, patient_phone, starts_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          )
          .run(a.doctorId, a.patientName, a.patientPhone, a.startsAt, 'booked', now),
      );
      return result ? (findById(Number(result.lastInsertRowid)) as AppointmentRow) : null;
    },

    // Moves an appointment to another slot of the same doctor.
    // Returns the moved appointment, or null when the slot is taken.
    move(row: AppointmentRow, startsAt: string): AppointmentRow | null {
      const moved = claimSlot(
        row.doctor_id,
        startsAt,
        () => db.prepare('UPDATE appointments SET starts_at = ? WHERE id = ?').run(startsAt, row.id),
        row.id,
      );
      return moved ? (findById(row.id) as AppointmentRow) : null;
    },

    // Marks the appointment cancelled (the row is kept) and returns it.
    cancel(id: number): AppointmentRow {
      const now = new Date().toISOString();
      db.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(now, id);
      return findById(id) as AppointmentRow;
    },
  };
}

export type AppointmentStore = ReturnType<typeof createAppointmentStore>;
