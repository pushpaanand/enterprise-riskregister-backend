const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const cwd = __dirname;
const localStandaloneEntry = path.join(cwd, '.next', 'standalone', 'server.js');
const deployedStandaloneEntry = path.join(cwd, 'server.js');

const resolvedEntry = fs.existsSync(localStandaloneEntry)
  ? localStandaloneEntry
  : deployedStandaloneEntry;

if (!fs.existsSync(resolvedEntry)) {
  console.error('Unable to find the Next.js standalone server entry file.');
  console.error(`Looked for: ${localStandaloneEntry}`);
  console.error(`and:        ${deployedStandaloneEntry}`);
  process.exit(1);
}

if (!process.env.PORT) {
  process.env.PORT = '4000';
}

(async () => {
  try {
    await import(pathToFileURL(resolvedEntry).href);
  } catch (error) {
    console.error('Failed to load Next.js standalone server entry:', error);
    process.exit(1);
  }
})();

