import { createServer } from './server.ts';
import { config, readAdminToken } from './config.ts';

const adminToken = readAdminToken();
if (typeof adminToken !== 'string') {
  console.error(`Not starting: ${adminToken.error}`);
  process.exit(1);
}

const server = createServer({ dbPath: config.dbPath, auditLogPath: config.auditLogPath, adminToken });

server.listen(config.port, '127.0.0.1', () => {
  console.log(`${config.clinicName} booking service on http://localhost:${config.port}`);
});
