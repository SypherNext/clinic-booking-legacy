import type { DatabaseSync } from 'node:sqlite';
import { sendJson, type Router } from '../router.ts';

export function doctorRoutes(router: Router, db: DatabaseSync) {
  router.add('GET', '/api/doctors', (_req, res) => {
    const rows = db.prepare('SELECT id, name, specialty FROM doctors ORDER BY id').all();
    sendJson(res, 200, rows);
  });

  router.add('GET', '/api/doctors/:id', (req, res) => {
    const row = db.prepare('SELECT id, name, specialty FROM doctors WHERE id = ?').get(Number(req.params.id));
    if (!row) return sendJson(res, 404, { error: 'Doctor not found' });
    sendJson(res, 200, row);
  });
}
