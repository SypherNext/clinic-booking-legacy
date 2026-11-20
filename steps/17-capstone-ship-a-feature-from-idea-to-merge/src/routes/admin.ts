// Front desk report: everything booked for one day, all doctors.
//
//   GET /admin/report?date=2030-03-04        JSON
//   GET /admin/report.csv?date=2030-03-04    CSV for the spreadsheet
//
// Both need the header  x-admin-token: <ADMIN_TOKEN from the environment>

import { createHash, timingSafeEqual } from 'node:crypto';
import { sendError, sendJson, sendText, type Handler, type Router } from '../router.ts';
import { config } from '../config.ts';
import { formatClinicTime, isValidDate } from '../lib/time.ts';
import type { AppointmentStore, ReportRow } from '../store/appointments.ts';

// Compares in constant time. Both sides are hashed first so the buffers always have
// the same length and the comparison does not reveal the token's length either.
function tokenMatches(given: unknown, expected: string) {
  if (typeof given !== 'string') return false;
  const a = createHash('sha256').update(given).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Wraps a handler so it only runs when the request carries the admin token.
export function adminOnly(adminToken: string, handler: Handler): Handler {
  return (req, res) => {
    if (!tokenMatches(req.headers['x-admin-token'], adminToken)) {
      return sendError(res, 401, 'Admin token required');
    }
    return handler(req, res);
  };
}

type ReportItem = ReturnType<typeof toReportItem>;

function toReportItem(r: ReportRow) {
  return {
    id: r.id,
    time: formatClinicTime(r.starts_at),
    doctor: r.doctor,
    patient: r.patient_name,
    phone: r.patient_phone || '',
    status: r.status,
  };
}

function reportJson(date: string, items: ReportItem[]) {
  return {
    clinic: config.clinicName,
    date,
    booked: items.filter((i) => i.status == 'booked').length,
    cancelled: items.filter((i) => i.status == 'cancelled').length,
    appointments: items,
  };
}

function csvCell(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function reportCsv(items: ReportItem[]) {
  const lines = ['time,doctor,patient,phone,status'];
  for (const i of items) {
    lines.push([i.time, i.doctor, i.patient, i.phone, i.status].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

export function adminRoutes(router: Router, appointments: AppointmentStore, adminToken: string) {
  router.add(
    'GET',
    '/admin/report',
    adminOnly(adminToken, (req, res) => {
      const date = req.query.date;
      if (!isValidDate(date)) return sendError(res, 400, 'date (YYYY-MM-DD) is required');
      const items = appointments.listDayForReport(date).map(toReportItem);
      sendJson(res, 200, reportJson(date, items));
    }),
  );

  router.add(
    'GET',
    '/admin/report.csv',
    adminOnly(adminToken, (req, res) => {
      const date = req.query.date;
      if (!isValidDate(date)) return sendError(res, 400, 'date (YYYY-MM-DD) is required');
      const items = appointments.listDayForReport(date).map(toReportItem);
      sendText(res, 200, reportCsv(items), 'text/csv; charset=utf-8');
    }),
  );
}
