#!/usr/bin/env node
// RunReceipt CLI.
//
//   node src/cli.js run listing-check --text "..."      (or --file listing.txt)
//   node src/cli.js run doc-digest --file README.md
//   node src/cli.js verify <runId>                       (uses stored anchor ref)
//   node src/cli.js verify <runId> --tx <txId>           (explicit anchor ref)
//   node src/cli.js list
//
// A run executes the task, writes the run log, advances the hash chain, and
// anchors the canonical log (mock registry by default; Arweave mainnet when
// ANCHOR_MODE=arweave and a wallet is configured — see .env.example).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { Store } from './store.js';
import { executeRun, canonicalLog } from './runner.js';
import { createAnchor } from './anchor.js';
import { verifyRun } from './verify.js';
import { TASKS } from './tasks.js';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const config = loadConfig(projectRoot);
const store = new Store(config.dataDir);

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function cmdRun(args) {
  const taskType = args[1];
  if (!taskType || !TASKS[taskType]) {
    console.error(`usage: run <${Object.keys(TASKS).join('|')}> --text "..." | --file <path>`);
    process.exit(2);
  }
  const file = argValue(args, '--file');
  const text = file ? readFileSync(file, 'utf8') : argValue(args, '--text');
  if (text === undefined) {
    console.error('provide --text "..." or --file <path>');
    process.exit(2);
  }

  const log = executeRun(store, {
    taskType,
    input: { text },
    agentName: config.agentName,
    agentModel: config.agentModel,
  });

  const anchor = createAnchor(config, store);
  const result = await anchor.anchorPayload(canonicalLog(log), { runId: log.runId, logHash: log.logHash });
  store.saveAnchor({ runId: log.runId, logHash: log.logHash, ...result });
  const { payload, ...anchorSummary } = result;

  console.log(JSON.stringify({
    runId: log.runId,
    task: taskType,
    verdict: log.output.verdict ?? undefined,
    logHash: log.logHash,
    prevLogHash: log.prevLogHash,
    anchor: anchorSummary,
  }, null, 2));
}

async function cmdVerify(args) {
  const runId = args[1];
  const log = runId ? store.loadRun(runId) : null;
  if (!log) {
    console.error(`run not found: ${runId ?? '(missing id)'}`);
    process.exit(2);
  }
  const record = store.loadAnchor(runId);
  const txId = argValue(args, '--tx') || record?.txId;
  const anchor = createAnchor(config, store);
  const result = await verifyRun(log, anchor, { txId });
  console.log(JSON.stringify({ runId, anchorMode: record?.mode ?? 'unknown', txId: txId ?? null, ...result, anchoredPayload: undefined }, null, 2));
  process.exit(result.ok ? 0 : 1);
}

function cmdList() {
  const chain = store.readChain();
  const anchors = store.readAnchors();
  console.log(JSON.stringify({ chain, anchors: Object.values(anchors).map(({ payload, ...r }) => r) }, null, 2));
}

const [cmd, ...rest] = process.argv.slice(2);
if (cmd === 'run') await cmdRun(['run', ...rest]);
else if (cmd === 'verify') await cmdVerify(['verify', ...rest]);
else if (cmd === 'list') cmdList();
else {
  console.error('commands: run | verify | list');
  process.exit(2);
}
