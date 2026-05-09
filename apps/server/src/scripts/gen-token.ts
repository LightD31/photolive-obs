import { randomBytes } from 'node:crypto';

// Print a 256-bit random token suitable for PHOTOLIVE_AUTH_TOKEN /
// settings.json `authToken`. 43 base64url chars, no padding.
process.stdout.write(`${randomBytes(32).toString('base64url')}\n`);
