// The runner: executes a task and produces the run log — the receipt itself.
//
// Log shape (all hashes are SHA-256 over canonical JSON):
//   task.inputHash   — proves exactly what the agent was given
//   outputHash       — proves exactly what the agent produced
//   prevLogHash      — hash of the previous run's log (hash chain: history
//                      cannot be silently deleted or reordered)
//   logHash          — hash of everything above; this is what gets anchored
//
// The anchored payload is the canonical serialization of the complete log
// (including logHash), so a verifier can compare byte-for-byte.

import { randomUUID } from 'node:crypto';
import { canonicalStringify, hashValue } from './canonical.js';
import { runTask } from './tasks.js';

export function buildRunLog({ taskType, input, agentName, agentModel, prevLogHash }) {
  const startedAt = new Date();
  const { output, steps } = runTask(taskType, input);
  const finishedAt = new Date();

  const log = {
    version: 1,
    runId: `run-${startedAt.toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`,
    agent: { name: agentName, model: agentModel },
    task: { type: taskType, input, inputHash: hashValue(input) },
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt - startedAt,
    steps,
    output,
    outputHash: hashValue(output),
    prevLogHash: prevLogHash ?? null,
  };
  log.logHash = hashValue(log);
  return log;
}

export function canonicalLog(log) {
  return canonicalStringify(log);
}

// Execute a task, persist the log, and advance the hash chain.
export function executeRun(store, opts) {
  const chain = store.readChain();
  const log = buildRunLog({ ...opts, prevLogHash: chain.lastLogHash });
  store.saveRun(log);
  store.writeChain({ lastLogHash: log.logHash, count: chain.count + 1 });
  return log;
}
