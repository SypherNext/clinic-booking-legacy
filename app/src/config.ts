// Settings for the booking service.
// Most of these used to live in settings.ini on the old clinic server.

export const config = {
  port: Number(process.env.PORT) || 18800,
  dbPath: process.env.DB_PATH || 'data/clinic.db',
  auditLogPath: process.env.AUDIT_LOG || 'data/audit.log',

  clinicName: 'Harbor Street Clinic',
  // The clinic runs on Pacific Standard Time (UTC-8).
  // NOTE: daylight saving time is not handled yet.
  utcOffsetMinutes: -480,
  openHour: 9, // first slot starts at 09:00
  closeHour: 17, // last slot ends at 17:00
  slotMinutes: 30,
  // no slot starts in the lunch break: from lunchStart up to, not including, lunchEnd
  lunchStart: '12:00',
  lunchEnd: '13:00',
  closedWeekdays: [0], // 0 = Sunday
};

export const MIN_ADMIN_TOKEN_LENGTH = 24;

// The token for the front desk report pages comes from the ADMIN_TOKEN environment
// variable (npm start loads it from .env). Returns the token or { error }.
// The error message never contains the token.
export function readAdminToken(env: NodeJS.ProcessEnv = process.env): string | { error: string } {
  const token = env.ADMIN_TOKEN;
  if (!token) {
    return { error: 'ADMIN_TOKEN is not set. Copy .env.example to .env and fill it in (see README.md).' };
  }
  if (token.length < MIN_ADMIN_TOKEN_LENGTH) {
    return { error: `ADMIN_TOKEN is too short: it needs at least ${MIN_ADMIN_TOKEN_LENGTH} characters (see README.md).` };
  }
  return token;
}
