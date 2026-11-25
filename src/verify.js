// Verification: given a run log and its anchor, decide whether the run
// happened exactly as recorded. Pure checks, no trust in the presenter:
//
//   1. task.inputHash recomputes from task.input
//   2. outputHash recomputes from output
//   3. logHash recomputes from the whole log minus logHash itself
//   4. the anchored payload, fetched independently from the anchor backend,
//      is byte-for-byte the canonical form of the presented log
//   5. (optional) prevLogHash matches the previous log's logHash — the chain
//      link that makes deleted/reordered history detectable
//
// Any mismatch fails with a named reason. Altering one byte of input, output,
// timestamps, or the chain link after anchoring fails check 3 and/or 4.

import { canonicalStringify, hashValue } from './canonical.js';

export function checkLogIntegrity(log) {
  const failures = [];
  if (hashValue(log.task.input) !== log.task.inputHash) failures.push('input_hash_mismatch');
  if (hashValue(log.output) !== log.outputHash) failures.push('output_hash_mismatch');
  const { logHash, ...rest } = log;
  if (hashValue(rest) !== logHash) failures.push('log_hash_mismatch');
  return failures;
}

export async function verifyRun(log, anchorBackend, { txId, previousLog } = {}) {
  const failures = checkLogIntegrity(log);

  if (previousLog !== undefined) {
    const expectedPrev = previousLog ? previousLog.logHash : null;
    if (log.prevLogHash !== expectedPrev) failures.push('chain_link_mismatch');
  }

  let anchoredPayload = null;
  if (txId) {
    try {
      anchoredPayload = await anchorBackend.fetchPayload(txId);
      if (anchoredPayload !== canonicalStringify(log)) failures.push('anchored_payload_mismatch');
    } catch (err) {
      failures.push(`anchor_fetch_failed: ${err.message}`);
    }
  } else {
    failures.push('no_anchor_reference');
  }

  return { ok: failures.length === 0, failures, anchoredPayload };
}
