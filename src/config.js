// Minimal config: environment variables, with an optional .env file.
// (Hand-rolled parser on purpose — one less dependency, and .env handling
// stays obvious. Values already in the environment win over the file.)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadConfig(projectRoot) {
  const envPath = join(projectRoot, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
    }
  }
  return {
    anchorMode: process.env.ANCHOR_MODE || 'mock',
    arweaveWalletPath: process.env.ARWEAVE_WALLET_PATH || '',
    arweaveGateway: process.env.ARWEAVE_GATEWAY || 'https://arweave.net',
    agentModel: process.env.AGENT_MODEL || 'runreceipt-rules-v1',
    agentName: process.env.AGENT_NAME || 'runreceipt-agent',
    dataDir: join(projectRoot, 'data'),
  };
}
