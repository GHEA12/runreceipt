// Anchoring: store the canonical run log somewhere permanent and get back a
// reference anyone can later fetch and compare against.
//
// Two backends behind one interface:
//   mock    — local registry file (data/anchors.json). The "transaction id"
//             is derived from the log hash. Proves the full flow today with
//             no wallet and no network. Clearly labelled mock everywhere.
//   arweave — real Arweave mainnet. Posts the canonical log as the
//             transaction data payload, tagged App-Name / Run-Id / Log-Hash /
//             Content-Type, signed with the wallet JWK from .env. Retrieval
//             is a plain GET on the gateway, no library needed.
//
// anchorPayload(payloadString) -> { txId, mode, anchoredAt }
// fetchPayload(txId)           -> payloadString (throws if not found)

import { readFileSync } from 'node:fs';
import { sha256Hex } from './canonical.js';

export class MockAnchor {
  constructor(store) {
    this.store = store;
    this.mode = 'mock';
  }

  async anchorPayload(payload, meta) {
    // Returns the full registry record (payload included); the caller saves
    // it via store.saveAnchor so the registry keeps exactly one writer.
    const txId = `mock-${sha256Hex(payload).slice(0, 40)}`;
    return {
      txId,
      mode: this.mode,
      anchoredAt: new Date().toISOString(),
      payload,
    };
  }

  async fetchPayload(txId) {
    const anchors = this.store.readAnchors();
    const found = Object.values(anchors).find((a) => a.txId === txId);
    if (!found) throw new Error(`mock anchor not found: ${txId}`);
    return found.payload;
  }
}

export class ArweaveAnchor {
  constructor({ walletPath, gateway }) {
    if (!walletPath) throw new Error('ARWEAVE_WALLET_PATH is not set (see .env.example)');
    this.wallet = JSON.parse(readFileSync(walletPath, 'utf8'));
    this.gateway = (gateway || 'https://arweave.net').replace(/\/$/, '');
    this.mode = 'arweave';
  }

  async anchorPayload(payload, meta) {
    // Lazy import: mock mode and tests never need the dependency installed.
    const { default: Arweave } = await import('arweave');
    const url = new URL(this.gateway);
    const arweave = Arweave.init({
      host: url.hostname,
      port: url.port ? Number(url.port) : 443,
      protocol: url.protocol.replace(':', ''),
    });
    const tx = await arweave.createTransaction({ data: payload }, this.wallet);
    tx.addTag('App-Name', 'RunReceipt');
    tx.addTag('Run-Id', meta.runId);
    tx.addTag('Log-Hash', meta.logHash);
    tx.addTag('Content-Type', 'application/json');
    await arweave.transactions.sign(tx, this.wallet);
    const res = await arweave.transactions.post(tx);
    if (res.status !== 200 && res.status !== 202) {
      throw new Error(`Arweave post failed: HTTP ${res.status}`);
    }
    return { txId: tx.id, mode: this.mode, anchoredAt: new Date().toISOString() };
  }

  async fetchPayload(txId) {
    const res = await fetch(`${this.gateway}/${txId}`, { redirect: 'follow' });
    if (!res.ok) throw new Error(`gateway fetch failed for ${txId}: HTTP ${res.status}`);
    return await res.text();
  }
}

export function createAnchor(config, store) {
  if (config.anchorMode === 'arweave') {
    return new ArweaveAnchor({ walletPath: config.arweaveWalletPath, gateway: config.arweaveGateway });
  }
  return new MockAnchor(store);
}
