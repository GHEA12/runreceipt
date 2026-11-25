// Local storage for run logs, the hash-chain head, and the mock anchor
// registry. Plain JSON files under <dataDir> — no database, nothing hidden.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export class Store {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.runsDir = join(dataDir, 'runs');
    this.chainPath = join(dataDir, 'chain.json');
    this.anchorsPath = join(dataDir, 'anchors.json');
    mkdirSync(this.runsDir, { recursive: true });
  }

  readChain() {
    if (!existsSync(this.chainPath)) return { lastLogHash: null, count: 0 };
    return JSON.parse(readFileSync(this.chainPath, 'utf8'));
  }

  writeChain(chain) {
    writeFileSync(this.chainPath, JSON.stringify(chain, null, 2) + '\n');
  }

  saveRun(log) {
    const path = join(this.runsDir, `${log.runId}.json`);
    writeFileSync(path, JSON.stringify(log, null, 2) + '\n');
    return path;
  }

  loadRun(runId) {
    const path = join(this.runsDir, `${runId}.json`);
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  }

  listRuns() {
    const chain = this.readChain();
    return chain;
  }

  readAnchors() {
    if (!existsSync(this.anchorsPath)) return {};
    return JSON.parse(readFileSync(this.anchorsPath, 'utf8'));
  }

  writeAnchors(anchors) {
    writeFileSync(this.anchorsPath, JSON.stringify(anchors, null, 2) + '\n');
  }

  saveAnchor(record) {
    const anchors = this.readAnchors();
    anchors[record.runId] = record;
    this.writeAnchors(anchors);
  }

  loadAnchor(runId) {
    return this.readAnchors()[runId] ?? null;
  }
}
