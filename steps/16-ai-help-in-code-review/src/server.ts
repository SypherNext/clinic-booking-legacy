// Builds the HTTP server. src/main.ts starts it; the tests start their own copy.

import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.ts';
import { createRouter } from './router.ts';
import { createAudit } from './lib/audit.ts';
import { createAppointmentStore } from './store/appointments.ts';
import { createDoctorStore } from './store/doctors.ts';
import { doctorRoutes } from './routes/doctors.ts';
import { slotRoutes } from './routes/slots.ts';
import { appointmentRoutes } from './routes/appointments.ts';
import { adminRoutes } from './routes/admin.ts';
import { todayRoutes } from './routes/today.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

// now: the clock for /api/today; defaults to the real one, tests pass a fixed time
export type ServerOptions = { dbPath: string; auditLogPath: string; adminToken: string; now?: () => Date };

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
  todayRoutes(router, opts.now ?? (() => new Date()));

  router.add('GET', '/api/health', (_req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  });

  const server = createHttpServer((req, res) => {
    router.handle(req, res);
  });
  server.on('close', () => db.close());
  return server;
}
