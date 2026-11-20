// GET /api/slots?doctorId=1&date=2030-03-04
// Lists every slot of the day for one doctor and says which ones are free.
//
// GET /api/slots/next?doctorId=1&date=2030-03-04
// The doctor's first free slot that has not started yet, on that date or one of the
// NEXT_FREE_DAYS - 1 days after it: { doctorId, from, slot: { date, time, startsAt } | null }.

import { sendError, sendJson, type Router } from '../router.ts';
import { config } from '../config.ts';
import { addDays, localToUtcIso, slotTimes, weekdayOf } from '../lib/time.ts';
import { checkDoctorDay } from '../lib/booking-rules.ts';
import type { AppointmentStore } from '../store/appointments.ts';
import type { DoctorStore } from '../store/doctors.ts';

// how many clinic days /api/slots/next looks at, the start date included
const NEXT_FREE_DAYS = 14;

export function slotRoutes(router: Router, doctors: DoctorStore, appointments: AppointmentStore) {
  router.add('GET', '/api/slots', (req, res) => {
    const q = checkDoctorDay(req.query);
    if ('error' in q) return sendError(res, 400, q.error);
    const { doctorId, date } = q;
    if (!doctors.findById(doctorId)) return sendError(res, 404, 'Doctor not found');

    if (config.closedWeekdays.includes(weekdayOf(date))) {
      return sendJson(res, 200, { doctorId, date, closed: true, slots: [] });
    }

    const taken = appointments.bookedStartTimes(doctorId, date);
    const slots = slotTimes().map((time) => {
      const startsAt = localToUtcIso(date, time);
      return { time, startsAt, available: !taken.has(startsAt) };
    });
    sendJson(res, 200, { doctorId, date, closed: false, slots });
  });

  router.add('GET', '/api/slots/next', (req, res) => {
    const q = checkDoctorDay(req.query);
    if ('error' in q) return sendError(res, 400, q.error);
    const { doctorId, date: from } = q;
    if (!doctors.findById(doctorId)) return sendError(res, 404, 'Doctor not found');

    const now = Date.now();
    for (let i = 0; i < NEXT_FREE_DAYS; i++) {
      const date = addDays(from, i);
      if (config.closedWeekdays.includes(weekdayOf(date))) continue;
      const taken = appointments.bookedStartTimes(doctorId, date);
      for (const time of slotTimes()) {
        const startsAt = localToUtcIso(date, time);
        if (Date.parse(startsAt) >= now && !taken.has(startsAt)) {
          return sendJson(res, 200, { doctorId, from, slot: { date, time, startsAt } });
        }
      }
    }
    sendJson(res, 200, { doctorId, from, slot: null });
  });
}
