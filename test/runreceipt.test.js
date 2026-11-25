// RunReceipt test suite — run with: npm test
//
// Covers the claims the project makes:
//   1. run -> log -> anchor (mock) -> verify round-trip passes
//   2. a tampered output fails verification
//   3. a tampered input fails verification
//   4. the hash chain links runs, and a broken link fails verification
//   5. tasks are reproducible: same input, same output hash

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Store } from '../src/store.js';
import { executeRun, canonicalLog } from '../src/runner.js';
import { MockAnchor } from '../src/anchor.js';
import { verifyRun, checkLogIntegrity } from '../src/verify.js';
import { runTask } from '../src/tasks.js';
import { canonicalStringify, hashValue } from '../src/canonical.js';

const CLEAN_LISTING = 'Vintage camera lens, 50mm f1.8, good condition. Price $120. ' +
  'Ships within 2 days, escrow accepted, contact via marketplace chat. ' +
  'Includes original box, lens cap, and a cleaning cloth. No scratches on the glass.';
const SCAM_LISTING = 'Crypto doubler! Guaranteed 100% safe, double your coins in 24 hours. ' +
  'Send deposit first to activate. Hurry, limited time. DM on Telegram only, no escrow.';

function freshStore() {
  return new Store(mkdtempSync(join(tmpdir(), 'runreceipt-test-')));
}

async function runAndAnchor(store, taskType, input) {
  const log = executeRun(store, {
    taskType,
    input,
    agentName: 'test-agent',
    agentModel: 'runreceipt-rules-v1',
  });
  const anchor = new MockAnchor(store);
  const rec = await anchor.anchorPayload(canonicalLog(log), { runId: log.runId, logHash: log.logHash });
  store.saveAnchor({ runId: log.runId, logHash: log.logHash, ...rec });
  return { log, anchor, txId: rec.txId };
}

test('round-trip: run -> anchor (mock) -> verify passes', async () => {
  const store = freshStore();
  const { log, anchor, txId } = await runAndAnchor(store, 'listing-check', { text: CLEAN_LISTING });
  assert.equal(log.output.verdict, 'pass');
  const result = await verifyRun(log, anchor, { txId, previousLog: null });
  assert.equal(result.ok, true, JSON.stringify(result.failures));
  assert.deepEqual(result.failures, []);
});

test('round-trip: doc-digest run verifies too', async () => {
  const store = freshStore();
  const doc = '# Title\n\nSome body text about permanent storage and agents.\n\n## Section\nMore text here.';
  const { log, anchor, txId } = await runAndAnchor(store, 'doc-digest', { text: doc });
  assert.deepEqual(log.output.headings, ['Title', 'Section']);
  const result = await verifyRun(log, anchor, { txId, previousLog: null });
  assert.equal(result.ok, true, JSON.stringify(result.failures));
});

test('tamper detection: altered output fails verification', async () => {
  const store = freshStore();
  const { log, anchor, txId } = await runAndAnchor(store, 'listing-check', { text: SCAM_LISTING });
  assert.equal(log.output.verdict, 'fail');
  const tampered = JSON.parse(JSON.stringify(log));
  tampered.output.verdict = 'pass'; // launder a scam verdict into a pass
  const result = await verifyRun(tampered, anchor, { txId });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('output_hash_mismatch'));
  assert.ok(result.failures.includes('log_hash_mismatch'));
  assert.ok(result.failures.includes('anchored_payload_mismatch'));
});

test('tamper detection: altered input fails verification', async () => {
  const store = freshStore();
  const { log, anchor, txId } = await runAndAnchor(store, 'listing-check', { text: SCAM_LISTING });
  const tampered = JSON.parse(JSON.stringify(log));
  tampered.task.input.text = CLEAN_LISTING; // pretend the agent checked a different listing
  const result = await verifyRun(tampered, anchor, { txId });
  assert.equal(result.ok, false);
  assert.ok(result.failures.includes('input_hash_mismatch'));
});

test('tamper detection: altered timestamp fails verification', async () => {
  const store = freshStore();
  const { log, anchor, txId } = await runAndAnchor(store, 'doc-digest', { text: 'hello world, this is a doc' });
  const tampered = JSON.parse(JSON.stringify(log));
  tampered.finishedAt = '2030-01-01T00:00:00.000Z'; // backdate the run
  assert.equal(checkLogIntegrity(tampered).includes('log_hash_mismatch'), true);
  const result = await verifyRun(tampered, anchor, { txId });
  assert.equal(result.ok, false);
});

test('hash chain: runs link, and a broken link fails', async () => {
  const store = freshStore();
  const first = await runAndAnchor(store, 'listing-check', { text: CLEAN_LISTING });
  const second = await runAndAnchor(store, 'doc-digest', { text: '# Notes\nchain test document body' });
  assert.equal(second.log.prevLogHash, first.log.logHash);

  const okResult = await verifyRun(second.log, second.anchor, { txId: second.txId, previousLog: first.log });
  assert.equal(okResult.ok, true, JSON.stringify(okResult.failures));

  const broken = await verifyRun(second.log, second.anchor, { txId: second.txId, previousLog: first.log && { logHash: 'deadbeef' } });
  assert.equal(broken.ok, false);
  assert.ok(broken.failures.includes('chain_link_mismatch'));
});

test('reproducibility: same input produces the same output hash', () => {
  const a = runTask('listing-check', { text: SCAM_LISTING });
  const b = runTask('listing-check', { text: SCAM_LISTING });
  assert.equal(hashValue(a.output), hashValue(b.output));
  assert.equal(a.output.verdict, 'fail');
  assert.ok(a.output.redFlags.includes('absolute_safety_claim'));
});

test('canonical JSON: key order does not change the hash', () => {
  const x = { b: 1, a: { d: [1, 2], c: 'x' } };
  const y = { a: { c: 'x', d: [1, 2] }, b: 1 };
  assert.equal(canonicalStringify(x), canonicalStringify(y));
  assert.equal(hashValue(x), hashValue(y));
});
