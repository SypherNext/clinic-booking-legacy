// GET /api/slots?doctorId=1&date=2030-03-04
// Lists every slot of the day for one doctor and says which ones are free.

import { sendError, sendJson, type Router } from '../router.ts';
import { config } from '../config.ts';
import { localToUtcIso, slotTimes, weekdayOf } from '../lib/time.ts';
import { checkDoctorDay } from '../lib/booking-rules.ts';
import type { AppointmentStore } from '../store/appointments.ts';
import type { DoctorStore } from '../store/doctors.ts';

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
}
