// Appointment endpoints used by the booking page.
//
//   GET    /api/appointments?doctorId=1&date=2030-03-04   list one doctor's day
//   GET    /api/appointments/:id                          one appointment
//   POST   /api/appointments                              book a slot
//   DELETE /api/appointments/:id                          cancel (the row is kept)

import type { DatabaseSync } from 'node:sqlite';
import { sendJson, type Router } from '../router.ts';
import type { Audit } from '../lib/audit.ts';
import { config } from '../config.ts';
import { isUniqueViolation } from '../db.ts';
import { clinicDayUtcRange, isValidDate } from '../lib/time.ts';
import { patientNameError, startsAtFormatError, startsAtPastError, startsAtSlotError } from '../lib/booking-rules.ts';

type Row = {
  id: number;
  doctor_id: number;
  patient_name: string;
  patient_phone: string | null;
  starts_at: string;
  status: string;
  created_at: string;
  cancelled_at: string | null;
};

// "2030-03-04T17:30:00.000Z" -> "9:30 AM" (clinic time)
function displayTime(iso: string): string {
  const d = new Date(iso);
  let mins = d.getUTCHours() * 60 + d.getUTCMinutes() + config.utcOffsetMinutes;
  if (mins < 0) mins += 24 * 60;
  if (mins >= 24 * 60) mins -= 24 * 60;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return h12 + ':' + (m < 10 ? '0' + m : m) + ' ' + suffix;
}

function toApi(row: Row) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    startsAt: row.starts_at,
    displayTime: displayTime(row.starts_at),
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export function appointmentRoutes(router: Router, db: DatabaseSync, audit: Audit) {
  router.add('GET', '/api/appointments', (req, res) => {
    const doctorId = Number(req.query.doctorId);
    const date = req.query.date;
    if (!doctorId || !isValidDate(date)) {
      return sendJson(res, 400, { error: 'doctorId and a date (YYYY-MM-DD) are required' });
    }
    const day = clinicDayUtcRange(date);
    const rows = db
      .prepare('SELECT * FROM appointments WHERE doctor_id = ? AND starts_at >= ? AND starts_at < ? ORDER BY starts_at')
      .all(doctorId, day.start, day.end) as Row[];
    sendJson(res, 200, rows.map(toApi));
  });

  router.add('GET', '/api/appointments/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(req.params.id)) as Row | undefined;
    if (!row) return sendJson(res, 404, { error: 'Appointment not found' });
    sendJson(res, 200, toApi(row));
  });

  router.add('POST', '/api/appointments', async (req, res) => {
    const body = req.body || {};
    if (!body.doctorId || !body.startsAt) {
      return sendJson(res, 400, { error: 'doctorId and startsAt are required' });
    }
    const nameError = patientNameError(body.patientName);
    if (nameError) return sendJson(res, 400, { error: nameError });
    const patientName = (body.patientName as string).trim();

    const doctor = db.prepare('SELECT id, name FROM doctors WHERE id = ?').get(Number(body.doctorId)) as
      | { id: number; name: string }
      | undefined;
    if (!doctor) return sendJson(res, 404, { error: 'Doctor not found' });

    const formatError = startsAtFormatError(body.startsAt);
    if (formatError) return sendJson(res, 400, { error: formatError });
    const startsAt = new Date(body.startsAt).toISOString();
    const slotError = startsAtSlotError(startsAt) ?? startsAtPastError(startsAt);
    if (slotError) return sendJson(res, 400, { error: slotError });

    let phone = null;
    if (body.patientPhone) {
      phone = String(body.patientPhone).replace(/[^\d+]/g, '');
      if (phone.length < 7) return sendJson(res, 400, { error: 'patientPhone looks too short' });
    }

    // is the slot free?
    const clash = db.prepare("SELECT id FROM appointments WHERE doctor_id = ? AND starts_at = ? AND status = 'booked'").get(doctor.id, startsAt);
    if (clash) return sendJson(res, 409, { error: 'That slot is already taken' });

    // insert straight after the check, with no await in between; the unique index
    // appointments_one_booking_per_slot catches anything that still slips through
    const now = new Date().toISOString();
    let result;
    try {
      result = db
        .prepare(
          'INSERT INTO appointments (doctor_id, patient_name, patient_phone, starts_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(doctor.id, patientName, phone, startsAt, 'booked', now);
    } catch (err) {
      if (isUniqueViolation(err)) return sendJson(res, 409, { error: 'That slot is already taken' });
      throw err;
    }

    await audit.write('booking', { doctorId: doctor.id, startsAt });

    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(Number(result.lastInsertRowid)) as Row;
    sendJson(res, 201, toApi(row));
  });

  router.add('DELETE', '/api/appointments/:id', async (req, res) => {
    const id = Number(req.params.id);
    const row = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row | undefined;
    if (!row) return sendJson(res, 404, { error: 'Appointment not found' });
    if (row.status === 'cancelled') return sendJson(res, 409, { error: 'Appointment is already cancelled' });

    const now = new Date().toISOString();
    db.prepare("UPDATE appointments SET status = 'cancelled', cancelled_at = ? WHERE id = ?").run(now, id);
    await audit.write('cancel', { id, doctorId: row.doctor_id, startsAt: row.starts_at });
    const updated = db.prepare('SELECT * FROM appointments WHERE id = ?').get(id) as Row;
    sendJson(res, 200, toApi(updated));
  });
}
