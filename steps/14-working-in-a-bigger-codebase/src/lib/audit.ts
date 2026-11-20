// Audit trail: one JSON line per booking event, appended to a log file.
// The front desk asked for this after the "missing appointment" incident in 2023.

import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export type Audit = {
  write(event: string, details: Record<string, unknown>): Promise<void>;
};

export function createAudit(path: string): Audit {
  let ready: Promise<unknown> | null = null;
  return {
    async write(event, details) {
      if (!ready) ready = mkdir(dirname(path), { recursive: true });
      await ready;
      const line = JSON.stringify({ at: new Date().toISOString(), event, ...details });
      await appendFile(path, line + '\n', 'utf8');
    },
  };
}
