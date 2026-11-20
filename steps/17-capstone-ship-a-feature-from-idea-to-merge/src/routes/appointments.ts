// Appointment endpoints used by the booking page.
//
//   GET    /api/appointments?doctorId=1&date=2030-03-04   list one doctor's day
//   GET    /api/appointments/:id                          one appointment
//   POST   /api/appointments                              book a slot
//   PATCH  /api/appointments/:id                          move to another slot, same doctor
//   DELETE /api/appointments/:id                          cancel (the row is kept)

import { sendError, sendJson, type Router } from '../router.ts';
import type { Audit } from '../lib/audit.ts';
import { formatClinicTime } from '../lib/time.ts';
import { checkDoctorDay, checkStartsAt, cleanPhone, doctorAwayError, patientNameError } from '../lib/booking-rules.ts';
import type { AppointmentRow, AppointmentStore } from '../store/appointments.ts';
import type { DaysOffStore } from '../store/days-off.ts';
import type { DoctorStore } from '../store/doctors.ts';

function toApi(row: AppointmentRow) {
  return {
    id: row.id,
    doctorId: row.doctor_id,
    patientName: row.patient_name,
    patientPhone: row.patient_phone,
    startsAt: row.starts_at,
    displayTime: formatClinicTime(row.starts_at),
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

const SLOT_TAKEN = 'That slot is already taken';
const NOT_FOUND = 'Appointment not found';

export function appointmentRoutes(
  router: Router,
  appointments: AppointmentStore,
  doctors: DoctorStore,
  daysOff: DaysOffStore,
  audit: Audit,
) {
  router.add('GET', '/api/appointments', (req, res) => {
    const q = checkDoctorDay(req.query);
    if ('error' in q) return sendError(res, 400, q.error);
    sendJson(res, 200, appointments.listDoctorDay(q.doctorId, q.date).map(toApi));
  });

  router.add('GET', '/api/appointments/:id', (req, res) => {
    const row = appointments.findById(Number(req.params.id));
    if (!row) return sendError(res, 404, NOT_FOUND);
    sendJson(res, 200, toApi(row));
  });

  router.add('POST', '/api/appointments', async (req, res) => {
    const body = (req.body || {}) as Record<string, unknown>;
    if (!body.doctorId || !body.startsAt) return sendError(res, 400, 'doctorId and startsAt are required');
    const nameError = patientNameError(body.patientName);
    if (nameError) return sendError(res, 400, nameError);
    const doctor = doctors.findById(Number(body.doctorId));
    if (!doctor) return sendError(res, 404, 'Doctor not found');
    const checked = checkStartsAt(body.startsAt);
    if ('error' in checked) return sendError(res, 400, checked.error);
    const phone = cleanPhone(body.patientPhone);
    if ('error' in phone) return sendError(res, 400, phone.error);
    const awayError = doctorAwayError(checked.startsAt, (date) => daysOff.isAway(doctor.id, date));
    if (awayError) return sendError(res, 400, awayError);

    const { startsAt } = checked;
    const row = appointments.insert({
      doctorId: doctor.id,
      patientName: (body.patientName as string).trim(),
      patientPhone: phone.phone,
      startsAt,
    });
    if (!row) return sendError(res, 409, SLOT_TAKEN);

    await audit.write('booking', { doctorId: doctor.id, startsAt });
    sendJson(res, 201, toApi(row));
  });

  router.add('PATCH', '/api/appointments/:id', async (req, res) => {
    const row = appointments.findById(Number(req.params.id));
    if (!row) return sendError(res, 404, NOT_FOUND);
    if (row.status !== 'booked') return sendError(res, 409, 'Only booked appointments can be moved');
    const checked = checkStartsAt(((req.body || {}) as Record<string, unknown>).startsAt);
    if ('error' in checked) return sendError(res, 400, checked.error);
    if (checked.startsAt === row.starts_at) return sendJson(res, 200, toApi(row));
    const awayError = doctorAwayError(checked.startsAt, (date) => daysOff.isAway(row.doctor_id, date));
    if (awayError) return sendError(res, 400, awayError);

    const moved = appointments.move(row, checked.startsAt);
    if (!moved) return sendError(res, 409, SLOT_TAKEN);

    await audit.write('reschedule', { id: row.id, from: row.starts_at, to: moved.starts_at });
    sendJson(res, 200, toApi(moved));
  });

  router.add('DELETE', '/api/appointments/:id', async (req, res) => {
    const row = appointments.findById(Number(req.params.id));
    if (!row) return sendError(res, 404, NOT_FOUND);
    if (row.status === 'cancelled') return sendError(res, 409, 'Appointment is already cancelled');

    const cancelled = appointments.cancel(row.id);
    await audit.write('cancel', { id: row.id, doctorId: row.doctor_id, startsAt: row.starts_at });
    sendJson(res, 200, toApi(cancelled));
  });
}
