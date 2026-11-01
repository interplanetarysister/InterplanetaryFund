import { execFileSync } from 'node:child_process';

const nodeVersion = process.versions.node;
const nodeMajor = Number(nodeVersion.split('.')[0]);
const nodeMinor = Number(nodeVersion.split('.')[1]);

let npmVersion = 'unknown';
try {
  npmVersion = execFileSync('npm', ['--version'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
} catch {
  // npm availability is reported for diagnostics; Node major is the hard gate.
}

// Firebase 13 requires Node >=24.12.0; test newer majors before release.
const MINIMUM_NODE_MAJOR = 24;
const MINIMUM_NODE_MINOR = 12;
const supportedRuntime = nodeMajor > MINIMUM_NODE_MAJOR ||
  (nodeMajor === MINIMUM_NODE_MAJOR && nodeMinor >= MINIMUM_NODE_MINOR);

if (!supportedRuntime) {
  console.error(
    `Node runtime preflight FAILED: executing Node ${nodeVersion} at ${process.execPath}. ` +
    `Node ${MINIMUM_NODE_MAJOR} .${MINIMUM_NODE_MINOR} or newer is required.`,
  );
  process.exit(1);
}

console.log(
  `Node runtime preflight passed: Node ${nodeVersion}, npm ${npmVersion}, executable ${process.execPath}.`,
);