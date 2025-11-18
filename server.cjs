const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const isProd = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 4000;

const candidateEntries = [
  path.join(__dirname, 'server.js'),
  path.join(__dirname, '.next', 'standalone', 'server.js'),
];

const standaloneEntry = candidateEntries.find((p) => fs.existsSync(p));

if (isProd && standaloneEntry) {
  console.log(`[server.cjs] Starting standalone Next.js server from ${standaloneEntry}`);
  import(pathToFileURL(standaloneEntry).href).catch((err) => {
    console.error('[server.cjs] Failed to launch standalone server', err);
    process.exit(1);
  });
} else {
  const next = require('next');
  const http = require('node:http');
  const dev = !isProd;
  const app = next({ dev });
  const handle = app.getRequestHandler();

  app.prepare().then(() => {
    http
      .createServer((req, res) => handle(req, res))
      .listen(port, () => console.log(`[server.cjs] Next.js server listening on port ${port}`));
  });
}

