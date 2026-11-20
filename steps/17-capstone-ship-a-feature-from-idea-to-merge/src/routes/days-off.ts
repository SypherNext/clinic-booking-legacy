// Doctors' days off, for the front desk. All need the header x-admin-token.
//
//   POST   /admin/days-off               add one: { doctorId, date, reason }
//   GET    /admin/days-off?from=DATE     days off on or after DATE (default: today), sorted by date
//   DELETE /admin/days-off/:id           remove one

import { sendError, sendJson, type Router } from '../router.ts';
import type { Audit } from '../lib/audit.ts';
import { checkDayOff } from '../lib/booking-rules.ts';
import { clinicToday, isValidDate } from '../lib/time.ts';
import { adminOnly } from './admin.ts';
import type { AppointmentStore } from '../store/appointments.ts';
import type { DayOffRow, DaysOffStore } from '../store/days-off.ts';
import type { DoctorStore } from '../store/doctors.ts';

function toApi(row: DayOffRow) {
  return { id: row.id, doctorId: row.doctor_id, date: row.date, reason: row.reason };
}

const ALREADY_AWAY = 'Already marked away on that day';

export function daysOffRoutes(
  router: Router,
  daysOff: DaysOffStore,
  doctors: DoctorStore,
  appointments: AppointmentStore,
  audit: Audit,
  adminToken: string,
  now: () => Date,
) {
  router.add(
    'POST',
    '/admin/days-off',
    adminOnly(adminToken, async (req, res) => {
      const checked = checkDayOff((req.body || {}) as Record<string, unknown>, clinicToday(now()));
      if ('error' in checked) return sendError(res, 400, checked.error);
      const { doctorId, date, reason } = checked;
      if (!doctors.findById(doctorId)) return sendError(res, 404, 'Doctor not found');
      if (daysOff.isAway(doctorId, date)) return sendError(res, 409, ALREADY_AWAY);
      if (appointments.bookedStartTimes(doctorId, date).size > 0) {
        return sendError(res, 409, 'Doctor has booked appointments that day; move or cancel them first');
      }

      const row = daysOff.add(doctorId, date, reason);
      if (!row) return sendError(res, 409, ALREADY_AWAY);

      await audit.write('day-off-added', { id: row.id, doctorId, date });
      sendJson(res, 201, toApi(row));
    }),
  );

  router.add(
    'GET',
    '/admin/days-off',
    adminOnly(adminToken, (req, res) => {
      const from = req.query.from ?? clinicToday(now());
      if (!isValidDate(from)) return sendError(res, 400, 'date (YYYY-MM-DD) is required');
      sendJson(res, 200, daysOff.list(from).map(toApi));
    }),
  );

  router.add(
    'DELETE',
    '/admin/days-off/:id',
    adminOnly(adminToken, async (req, res) => {
      const row = daysOff.findById(Number(req.params.id));
      if (!row || !daysOff.remove(row.id)) return sendError(res, 404, 'Day off not found');

      await audit.write('day-off-removed', { id: row.id, doctorId: row.doctor_id, date: row.date });
      sendJson(res, 200, toApi(row));
    }),
  );
}
