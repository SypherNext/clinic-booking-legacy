// Builds the HTTP server. src/main.ts starts it; the tests start their own copy.

import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.ts';
import { createRouter } from './router.ts';
import { createAudit } from './lib/audit.ts';
import { doctorRoutes } from './routes/doctors.ts';
import { slotRoutes } from './routes/slots.ts';
import { appointmentRoutes } from './routes/appointments.ts';
import { adminRoutes } from './routes/admin.ts';

const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));

export type ServerOptions = { dbPath: string; auditLogPath: string };

export function createServer(opts: ServerOptions) {
  const db = openDb(opts.dbPath);
  const audit = createAudit(opts.auditLogPath);
  const router = createRouter(PUBLIC_DIR);

  doctorRoutes(router, db);
  slotRoutes(router, db);
  appointmentRoutes(router, db, audit);
  adminRoutes(router, db);

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
