import { sendJson, type Router } from '../router.ts';
import { clinicToday } from '../lib/time.ts';

// the pages ask for today's clinic date here, because the browser clock may be in another zone
export function todayRoutes(router: Router, now: () => Date) {
  router.add('GET', '/api/today', (_req, res) => {
    sendJson(res, 200, { date: clinicToday(now()) });
  });
}
