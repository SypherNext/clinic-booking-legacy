// A very small router. We did not want a framework for six endpoints,
// and then the six endpoints became twelve.

import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

export type Req = IncomingMessage & {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
};
export type Handler = (req: Req, res: ServerResponse) => unknown;

type Route = { method: string; regex: RegExp; keys: string[]; handler: Handler };

const MAX_BODY_BYTES = 10_000;

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function sendJson(res: ServerResponse, status: number, body: unknown) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

// Every API error goes out as JSON: { "error": message }
export function sendError(res: ServerResponse, status: number, message: string) {
  sendJson(res, status, { error: message });
}

export function sendText(res: ServerResponse, status: number, text: string, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, 'Request body is too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function createRouter(publicDir: string) {
  const routes: Route[] = [];

  function add(method: string, path: string, handler: Handler) {
    const keys: string[] = [];
    const pattern = path.replace(/:(\w+)/g, (_m, key) => {
      keys.push(key);
      return '([^/]+)';
    });
    routes.push({ method, regex: new RegExp('^' + pattern + '$'), keys, handler });
  }

  async function serveStatic(pathname: string, res: ServerResponse) {
    const file = pathname === '/' ? '/index.html' : pathname;
    const full = normalize(join(publicDir, file));
    if (!full.startsWith(normalize(publicDir))) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    try {
      const data = await readFile(full);
      res.writeHead(200, { 'content-type': MIME[extname(full)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      sendText(res, 404, 'Not found');
    }
  }

  async function handle(rawReq: IncomingMessage, res: ServerResponse) {
    const req = rawReq as Req;
    const url = new URL(req.url || '/', 'http://localhost');
    req.query = Object.fromEntries(url.searchParams);
    req.params = {};

    try {
      let pathMatched = false;
      for (const r of routes) {
        const m = r.regex.exec(url.pathname);
        if (!m) continue;
        pathMatched = true;
        if (r.method !== req.method) continue;
        r.keys.forEach((k, i) => (req.params[k] = decodeURIComponent(m[i + 1])));
        if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
          const text = await readBody(req);
          if (text) {
            try {
              req.body = JSON.parse(text);
            } catch {
              throw new HttpError(400, 'Body must be valid JSON');
            }
          }
        }
        await r.handler(req, res);
        return;
      }
      if (pathMatched) return sendError(res, 405, 'Method not allowed');
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin/')) {
        return sendError(res, 404, 'Not found');
      }
      if (req.method === 'GET') return await serveStatic(url.pathname, res);
      sendError(res, 404, 'Not found');
    } catch (err) {
      if (err instanceof HttpError) return sendError(res, err.status, err.message);
      console.error(err);
      if (!res.headersSent) sendError(res, 500, 'Something went wrong');
    }
  }

  return { add, handle };
}

export type Router = ReturnType<typeof createRouter>;
