import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend/dist');

// API requests always continue to the API handlers, including their JSON 404.
export function mountFrontend(app, { directory = defaultDirectory, required = false } = {}) {
  const indexFile = resolve(directory, 'index.html');
  if (!existsSync(indexFile)) {
    if (required) throw new Error('Frontend build is missing. Run npm run build --prefix frontend before starting the production server.');
    return false;
  }

  const serveFiles = express.static(directory, {
    index: false,
    setHeaders(res, file) {
      if (file === indexFile) res.setHeader('Cache-Control', 'no-cache');
    },
  });

  app.use((req, res, next) => {
    if (/^\/api(?:\/|$)/i.test(req.path)) return next();
    serveFiles(req, res, error => {
      if (error) return next(error);
      // Missing assets and non-page requests must not receive HTML as a fallback.
      if (!['GET', 'HEAD'].includes(req.method) || extname(req.path) || !req.accepts('html')) return next();
      res.sendFile(indexFile, { headers: { 'Cache-Control': 'no-cache' } }, error => {
        if (error) next(error);
      });
    });
  });
  return true;
}
