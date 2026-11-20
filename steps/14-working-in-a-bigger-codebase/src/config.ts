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

  // token for the front desk report pages
  // TODO: move this somewhere safer before we go live
  adminToken: 'hsc-admin-7f3a9c2e51',
};
