# RunReceipt

**Verifiable agent run-logs anchored on Arweave.**

Every time an AI agent does a piece of work, RunReceipt produces a structured
run log — what the agent was given, what it produced, when, and by which
model — hashes it, chains it to the previous run, and anchors the full log
permanently on Arweave. Anyone can later verify, byte-for-byte, that a run
happened exactly as recorded. If a single byte was altered after anchoring,
verification fails.

Built by Indra Dwi Junianto for the Decentralize AI Hackathon by HackerNoon
(Round 2), targeting the Arweave permanent-storage / verifiable-AI themes.

## Why

Agent work product today is a chat transcript or nothing. There is no durable,
tamper-evident record of what an agent was asked, what it returned, and when.
RunReceipt is the missing receipt layer: cheap to produce, permanent by
default (Arweave's pay-once model), and verifiable by anyone with a browser.

## How it works

1. **Run** — the agent executes a small, well-defined task. v1 ships two
   deterministic tasks (`listing-check`, `doc-digest`); the log schema is
   task-agnostic, so LLM-backed tasks plug in by returning the same shape.
2. **Log** — the runner emits a canonical-JSON run log containing the input
   and its SHA-256 hash, the output and its hash, timestamps, the producing
   model/engine, a step trace, and `prevLogHash` — a hash chain across runs
   that makes deleted or reordered history detectable.
3. **Anchor** — the canonical log is stored as an Arweave transaction payload
   tagged `App-Name: RunReceipt`, `Run-Id`, and `Log-Hash`.
4. **Verify** — the static verify page (`verify-page/index.html`) recomputes
   every hash in the browser and compares the log against the anchored copy,
   fetched from Arweave by transaction id. No server, no trust.

## Quick start (mock mode — no wallet, no network)

```bash
npm test                                   # 8 tests: round-trip + tamper detection
node src/cli.js run listing-check --text "Vintage lens, good condition. Price \$120. Escrow accepted."
node src/cli.js run doc-digest --file README.md
node src/cli.js list                       # chain head + anchor registry
node src/cli.js verify <runId>             # exit 0 = verified, exit 1 = tampered/unverifiable
```

Mock mode anchors into a local registry (`data/anchors.json`) with
clearly-labelled `mock-…` transaction ids, so the complete flow is provable
before any wallet exists.

## Real Arweave mode

```bash
cp .env.example .env   # set ANCHOR_MODE=arweave and ARWEAVE_WALLET_PATH
npm install            # installs the arweave-js dependency
node src/cli.js run listing-check --file listing.txt
```

The wallet JWK is read from the path in `.env` and never leaves the machine;
posting is the only network call. Retrieval during verification is a plain
gateway GET.

## Layout

- `src/canonical.js` — canonical JSON + SHA-256 (the byte-compatibility core)
- `src/tasks.js` — the v1 task set
- `src/runner.js` — run-log construction and hash chaining
- `src/anchor.js` — anchoring backends: `MockAnchor`, `ArweaveAnchor`
- `src/verify.js` — verification checks (input/output/log hashes, chain link, anchored payload)
- `src/cli.js` — `run | verify | list`
- `verify-page/` — dependency-free static verify page + sample run
- `test/` — round-trip and tamper-detection tests
- `data/` — run logs, chain head, mock anchor registry from the demo runs

## Honesty notes

- Demo runs in `data/` were produced in **mock anchor mode** on 2026-11-25.
  The first **real Arweave mainnet anchor** was posted the same day, after
  the entrant funded the wallet: run
  `run-2026-11-25T07-21-32-175Z-b79005f5`, tx
  `zqw7M6ZbAsU4n3LKZ-WRPtLVk-T6mc-ZdH_UBUFH5lQ`, verified end to end
  (see `../EVIDENCE.md`).
- The v1 tasks are deterministic rule engines, and the logs say so
  (`model: runreceipt-rules-v1`). The schema records whatever model actually
  produced the output — no relabelling.
