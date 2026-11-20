// GET /api/slots?doctorId=1&date=2030-03-04
// Lists every slot of the day for one doctor and says which ones are free.
// On a closed day, or a day the doctor is away, closed is true and there are no slots;
// away says which of the two it is.
//
// GET /api/slots/next?doctorId=1&date=2030-03-04
// The doctor's first free slot that has not started yet, on that date or one of the
// NEXT_FREE_DAYS - 1 days after it, skipping the doctor's days off:
// { doctorId, from, slot: { date, time, startsAt } | null }.

import { sendError, sendJson, type Router } from '../router.ts';
import { checkDoctorDay } from '../lib/booking-rules.ts';
import { daySlots, findNextFreeSlot, isOpenDay } from '../lib/schedule.ts';
import type { AppointmentStore } from '../store/appointments.ts';
import type { DaysOffStore } from '../store/days-off.ts';
import type { DoctorStore } from '../store/doctors.ts';

// how many clinic days /api/slots/next looks at, the start date included
const NEXT_FREE_DAYS = 14;

export function slotRoutes(router: Router, doctors: DoctorStore, appointments: AppointmentStore, daysOff: DaysOffStore) {
  router.add('GET', '/api/slots', (req, res) => {
    const q = checkDoctorDay(req.query);
    if ('error' in q) return sendError(res, 400, q.error);
    const { doctorId, date } = q;
    if (!doctors.findById(doctorId)) return sendError(res, 404, 'Doctor not found');

    if (!isOpenDay(date)) {
      return sendJson(res, 200, { doctorId, date, closed: true, away: false, slots: [] });
    }
    if (daysOff.isAway(doctorId, date)) {
      return sendJson(res, 200, { doctorId, date, closed: true, away: true, slots: [] });
    }

    const slots = daySlots(date, appointments.bookedStartTimes(doctorId, date));
    sendJson(res, 200, { doctorId, date, closed: false, away: false, slots });
  });

  router.add('GET', '/api/slots/next', (req, res) => {
    const q = checkDoctorDay(req.query);
    if ('error' in q) return sendError(res, 400, q.error);
    const { doctorId, date: from } = q;
    if (!doctors.findById(doctorId)) return sendError(res, 404, 'Doctor not found');

    const slot = findNextFreeSlot(
      from,
      NEXT_FREE_DAYS,
      (date) => appointments.bookedStartTimes(doctorId, date),
      (date) => daysOff.isAway(doctorId, date),
    );
    sendJson(res, 200, { doctorId, from, slot });
  });
}
