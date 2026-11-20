// Builds the HTTP server. src/main.ts starts it; the tests start their own copy.

import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.ts';
import { createRouter, sendJson } from './router.ts';
import { clinicToday } from './lib/time.ts';
import { createAudit } from './lib/audit.ts';
import { createAppointmentStore } from './store/appointments.ts';
import { createDoctorStore } from './store/doctors.ts';
import { doctorRoutes } from './routes/doctors.ts';
import { slotRoutes } from './routes/slots.ts';
import { appointmentRoutes } from './routes/appointments.ts';
import { adminRoutes } from './routes/admin.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

export type ServerOptions = { dbPath: string; auditLogPath: string; adminToken: string };

export function createServer(opts: ServerOptions) {
  const db = openDb(opts.dbPath);
  const audit = createAudit(opts.auditLogPath);
  const doctors = createDoctorStore(db);
  const appointments = createAppointmentStore(db);
  const router = createRouter(PUBLIC_DIR);

  doctorRoutes(router, doctors);
  slotRoutes(router, doctors, appointments);
  appointmentRoutes(router, appointments, doctors, audit);
  adminRoutes(router, appointments, opts.adminToken);

  router.add('GET', '/api/health', (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });

  // the pages ask for today's clinic date here, because the browser clock may be in another zone
  router.add('GET', '/api/today', (_req, res) => {
    sendJson(res, 200, { date: clinicToday() });
  });

  const server = createHttpServer((req, res) => {
    router.handle(req, res);
  });
  server.on('close', () => db.close());
  return server;
}
