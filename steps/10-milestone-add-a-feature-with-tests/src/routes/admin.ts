// Front desk report: everything booked for one day, all doctors.
//
//   GET /admin/report?date=2030-03-04        JSON
//   GET /admin/report.csv?date=2030-03-04    CSV for the spreadsheet
//
// Both need the header  x-admin-token: <token from config.ts>

import type { DatabaseSync } from 'node:sqlite';
import type { IncomingMessage } from 'node:http';
import { sendJson, sendText, type Router } from '../router.ts';
import { config } from '../config.ts';
import { clinicDayUtcRange } from '../lib/time.ts';

function isAdmin(req: IncomingMessage) {
  return req.headers['x-admin-token'] === config.adminToken;
}

// copied from the old report script
function fmtTime(iso: string) {
  const t = Date.parse(iso) + config.utcOffsetMinutes * 60 * 1000;
  const d = new Date(t);
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  const ampm = h < 12 ? 'AM' : 'PM';
  let hh = h % 12;
  if (hh == 0) hh = 12;
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`;
}

function checkDate(date: any) {
  if (!date) return false;
  if (!/^\d\d\d\d-\d\d-\d\d$/.test(date)) return false;
  return !isNaN(Date.parse(date));
}

function loadDay(db: DatabaseSync, date: string) {
  const day = clinicDayUtcRange(date);
  const rows = db
    .prepare(
      `SELECT a.id, a.starts_at, a.patient_name, a.patient_phone, a.status, d.name AS doctor
       FROM appointments a JOIN doctors d ON d.id = a.doctor_id
       WHERE a.starts_at >= ? AND a.starts_at < ?
       ORDER BY a.starts_at, d.name`,
    )
    .all(day.start, day.end) as any[];
  return rows.map((r) => ({
    id: r.id,
    time: fmtTime(r.starts_at),
    doctor: r.doctor,
    patient: r.patient_name,
    phone: r.patient_phone || '',
    status: r.status,
  }));
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function adminRoutes(router: Router, db: DatabaseSync) {
  router.add('GET', '/admin/report', (req, res) => {
    if (!isAdmin(req)) return sendJson(res, 401, { error: 'Admin token required' });
    const date = req.query.date;
    if (!checkDate(date)) return sendJson(res, 400, { error: 'date (YYYY-MM-DD) is required' });
    const items = loadDay(db, date);
    sendJson(res, 200, {
      clinic: config.clinicName,
      date,
      booked: items.filter((i) => i.status == 'booked').length,
      cancelled: items.filter((i) => i.status == 'cancelled').length,
      appointments: items,
    });
  });

  router.add('GET', '/admin/report.csv', (req, res) => {
    if (!isAdmin(req)) return sendJson(res, 401, { error: 'Admin token required' });
    const date = req.query.date;
    if (!checkDate(date)) return sendJson(res, 400, { error: 'date (YYYY-MM-DD) is required' });
    const lines = ['time,doctor,patient,phone,status'];
    for (const i of loadDay(db, date)) {
      lines.push([i.time, i.doctor, i.patient, i.phone, i.status].map(csvCell).join(','));
    }
    sendText(res, 200, lines.join('\n') + '\n', 'text/csv; charset=utf-8');
  });
}
