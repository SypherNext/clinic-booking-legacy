// GET /api/slots?doctorId=1&date=2030-03-04
// Lists every slot of the day for one doctor and says which ones are free.

import type { DatabaseSync } from 'node:sqlite';
import { sendJson, type Router } from '../router.ts';
import { config } from '../config.ts';
import { clinicDayUtcRange, isValidDate, localToUtcIso, slotTimes, weekdayOf } from '../lib/time.ts';

export function slotRoutes(router: Router, db: DatabaseSync) {
  router.add('GET', '/api/slots', (req, res) => {
    const doctorId = Number(req.query.doctorId);
    const date = req.query.date;
    if (!doctorId || !isValidDate(date)) {
      return sendJson(res, 400, { error: 'doctorId and a date (YYYY-MM-DD) are required' });
    }
    const doctor = db.prepare('SELECT id FROM doctors WHERE id = ?').get(doctorId);
    if (!doctor) return sendJson(res, 404, { error: 'Doctor not found' });

    if (config.closedWeekdays.includes(weekdayOf(date))) {
      return sendJson(res, 200, { doctorId, date, closed: true, slots: [] });
    }

    // appointments already booked that day
    const day = clinicDayUtcRange(date);
    const rows = db
      .prepare(
        "SELECT starts_at FROM appointments WHERE doctor_id = ? AND status = 'booked' AND starts_at >= ? AND starts_at < ?",
      )
      .all(doctorId, day.start, day.end) as { starts_at: string }[];
    const taken = new Set(rows.map((r) => r.starts_at));

    const slots = slotTimes().map((time) => {
      const startsAt = localToUtcIso(date, time);
      return { time, startsAt, available: !taken.has(startsAt) };
    });
    sendJson(res, 200, { doctorId, date, closed: false, slots });
  });
}
