const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const port = process.env.PORT || 4000;
const candidateEntries = [
  path.join(__dirname, 'server.js'),
  path.join(__dirname, '.next', 'standalone', 'server.js'),
];

const startDevServer = () => {
  const next = require('next');
  const http = require('node:http');
  const dev = process.env.NODE_ENV !== 'production';
  const app = next({ dev });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => console.log(`[server.cjs] Next.js server listening on port ${port}`));
  });
};

const standaloneEntry = candidateEntries.find((p) => fs.existsSync(p));

if (standaloneEntry) {
  console.log(`[server.cjs] Starting standalone Next.js server from ${standaloneEntry}`);
  import(pathToFileURL(standaloneEntry).href).catch((err) => {
    console.error('[server.cjs] Failed to launch standalone server, falling back to Next dev server', err);
    startDevServer();
  });
} else {
  console.warn('[server.cjs] Standalone bundle not found, starting Next dev server');
  startDevServer();
}

