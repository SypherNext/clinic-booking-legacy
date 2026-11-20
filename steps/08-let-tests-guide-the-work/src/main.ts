import { createServer } from './server.ts';
import { config } from './config.ts';

const server = createServer({ dbPath: config.dbPath, auditLogPath: config.auditLogPath });

server.listen(config.port, '127.0.0.1', () => {
  console.log(`${config.clinicName} booking service on http://localhost:${config.port}`);
});
