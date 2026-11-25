// Canonical JSON + SHA-256 helpers.
//
// Verification only works if the same logical log always serializes to the
// same bytes. canonicalStringify sorts object keys recursively and rejects
// values JSON cannot represent deterministically (undefined, functions,
// non-finite numbers), so a hash computed at run time can be recomputed
// byte-for-byte by anyone, anywhere, later.

import { createHash } from 'node:crypto';

export function canonicalStringify(value) {
  if (value === null) return 'null';
  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number in canonical JSON');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  if (t === 'object') {
    const keys = Object.keys(value).sort();
    const parts = keys.map((k) => JSON.stringify(k) + ':' + canonicalStringify(value[k]));
    return '{' + parts.join(',') + '}';
  }
  throw new Error(`unsupported type in canonical JSON: ${t}`);
}

export function sha256Hex(data) {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  return createHash('sha256').update(buf).digest('hex');
}

export function hashValue(value) {
  return sha256Hex(canonicalStringify(value));
}
