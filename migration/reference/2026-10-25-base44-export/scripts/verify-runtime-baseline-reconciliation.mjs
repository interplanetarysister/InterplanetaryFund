import { verifyReleaseContract } from './verify-node22-release-contract.mjs';

const errors = verifyReleaseContract();
if (errors.length) {
  console.error('Runtime baseline reconciliation FAILED');
  for (const error of errors) {
    if (error.startsWith('malformed:package.json')) {
      console.error('- package.json is not valid JSON');
    } else if (error.startsWith('malformed:package-lock.json')) {
      console.error('- package-lock.json is not valid JSON');
    } else {
      console.error(`- ${error}`);
    }
  }
  process.exit(1);
}

console.log('Runtime baseline reconciliation passed: the tested Node 24 lane and minimum >=24.12.0.');
