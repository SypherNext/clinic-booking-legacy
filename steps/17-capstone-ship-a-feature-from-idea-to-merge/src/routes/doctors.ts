import { sendError, sendJson, type Router } from '../router.ts';
import type { DoctorStore } from '../store/doctors.ts';

export function doctorRoutes(router: Router, doctors: DoctorStore) {
  router.add('GET', '/api/doctors', (_req, res) => {
    sendJson(res, 200, doctors.list());
  });

  router.add('GET', '/api/doctors/:id', (req, res) => {
    const row = doctors.findById(Number(req.params.id));
    if (!row) return sendError(res, 404, 'Doctor not found');
    sendJson(res, 200, row);
  });
}
