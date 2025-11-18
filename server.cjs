const fs = require('node:fs');
const path = require('node:path');

const port = process.env.PORT || 3000;

// In production, prefer running Next's standalone output if present.
const candidatePaths = [
	path.join(__dirname, 'server.cjs'), // when standalone output is copied to root
	path.join(__dirname, '.next', 'standalone', 'server.js'), // fallback for older packaging
];

const standaloneServerPath = candidatePaths.find((p) => fs.existsSync(p));

if (process.env.NODE_ENV === 'production' && standaloneServerPath) {
	console.log(`Detected standalone bundle at ${standaloneServerPath}. Starting standalone server...`);
	require(standaloneServerPath);
} else {
	// Fallback: start Next directly (useful for local dev or non-standalone builds)
	const { createServer } = require('http');
	const next = require('next');
	const dev = process.env.NODE_ENV !== 'production';
	const app = next({ dev });
	const handle = app.getRequestHandler();

	app.prepare().then(() => {
		createServer((req, res) => {
			handle(req, res);
		}).listen(port, () => {
			console.log(`Next.js server listening on port ${port}`);
		});
	});
}


