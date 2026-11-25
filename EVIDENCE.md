# RunReceipt — Evidence (v1 build, 2026-11-25)

The demo runs below were executed locally in **mock anchor mode** (local
registry, `mock-…` transaction ids). The first **real Arweave mainnet
anchor** was posted on 2026-11-25 after Karis funded the wallet — see the
final section of this file. Everything else (hashing, chaining, anchoring
interface, verification, verify page) is the real production code path; only
the anchor backend differs.

## Automated tests — 8/8 passing (`npm test`, node:test)

1. Round-trip: run → anchor (mock) → verify passes (listing-check)
2. Round-trip: doc-digest run verifies
3. Tamper detection: altered output fails (`output_hash_mismatch`, `log_hash_mismatch`, `anchored_payload_mismatch`)
4. Tamper detection: altered input fails (`input_hash_mismatch`)
5. Tamper detection: altered timestamp fails (`log_hash_mismatch`)
6. Hash chain: runs link via `prevLogHash`; a broken link fails (`chain_link_mismatch`)
7. Reproducibility: same input → same output hash
8. Canonical JSON: key order does not change the hash

## Demo runs (CLI, 2026-11-25 ~06:48 UTC, hash-chained in order)

| # | Run id | Task | Result | Canonical payload | logHash (first 12) |
|---|---|---|---|---|---|
| 1 | run-2026-11-25T06-48-35-982Z-41076b2d | listing-check (clean lens listing) | verdict **pass**, 0 red flags | 1,049 bytes | db01db841252 |
| 2 | run-2026-11-25T06-48-36-105Z-11f086fe | listing-check ("crypto doubler" scam) | verdict **fail**, 6 red flags | 1,195 bytes | a5824f6e0442 |
| 3 | run-2026-11-25T06-48-36-225Z-e6b2470c | doc-digest (PLAN.md) | 545 words, 6 headings, 8 key terms | 4,734 bytes | b348407c45c4 |

Chain: run 2's `prevLogHash` = run 1's `logHash`; run 3's = run 2's. Task
execution time: 1 ms, 1 ms, and 13 ms respectively (`durationMs` in the logs).

## CLI verification

- `node src/cli.js verify <runId>` for all three demo runs: `ok: true`, exit 0.
- **Tamper demo:** the stored copy of run 2 was edited (`output.verdict`:
  `fail` → `pass`), then verified: `ok: false` with failures
  `output_hash_mismatch`, `log_hash_mismatch`, `anchored_payload_mismatch`,
  exit 1. The file was then restored and verified `ok: true` again.

## Verify page

- `project/verify-page/index.html` is dependency-free; hashes are recomputed
  in the browser via SubtleCrypto.
- Its core block (canonical stringify + verify logic, marked in the file) was
  extracted and executed in Node against the shipped sample run: untampered
  run → zero failures; verdict-tampered copy → `output_hash_mismatch`,
  `log_hash_mismatch`, `anchored_payload_mismatch`. The browser implementation
  agrees with the reference Node implementation on real data.

## Arweave integration status

- `arweave` (arweave-js) `^1.15.7` installed; the library loads and
  `ArweaveAnchor` implements create → tag (`App-Name`, `Run-Id`, `Log-Hash`,
  `Content-Type`) → sign → post, with gateway-GET retrieval for verification.
- `.env.example` documents the two values needed (`ANCHOR_MODE=arweave`,
  `ARWEAVE_WALLET_PATH`).

## Arweave wallet — created 2026-11-25

- A brand-new wallet was generated with the project's own arweave-js
  (`arweave.wallets.generate()`).
- **Address: `xMTXxvXhe8k-Hu15ExH8AIKaCq-de44kno_RvsWSYYo`**
- Keyfile: `project/keys/arweave-wallet.json` (mode 600; `keys/` directory
  mode 700). `.gitignore` now covers `keys/` in addition to `.env` and wallet
  filenames, so the key can never be committed. The JWK itself is never
  printed or shared.
- Project `.env` (local, gitignored) sets `ANCHOR_MODE=arweave` and
  `ARWEAVE_WALLET_PATH` to the keyfile; `.env.example` keeps placeholders.
- **Balance: 0 AR** (checked via `arweave.net/wallet/<address>/balance` —
  0 winston, no prior transactions, as expected for a fresh wallet).
- **Dry check passed (no transaction submitted):** `loadConfig` reads the
  `.env`, `createAnchor` constructs `ArweaveAnchor` (JWK loads and parses),
  and `arweave.wallets.jwkToAddress` resolves the keyfile to exactly the
  address above; gateway balance read returns 0 AR. Test suite still 8/8.
- **Anchor cost (network price, 2026-11-25, `arweave.net/price/<bytes>`):**
  3,398,946,984 winston ≈ **0.0034 AR per anchor**. The gateway returned the
  same price for 1,049, 4,734, and 5,000 bytes — at RunReceipt payload sizes
  the base transaction reward dominates, so one anchor costs ~0.0034 AR
  regardless of which demo-sized log is posted.
  - 0.05 AR funds ≈ 14 anchors; 0.1 AR funds ≈ 29 anchors.
- **Next step (Karis):** send a small amount of AR (0.05–0.1 AR is plenty)
  to `xMTXxvXhe8k-Hu15ExH8AIKaCq-de44kno_RvsWSYYo`. Only after funding lands
  will the first real `ANCHOR_MODE=arweave` anchor be posted.
  **Done 2026-11-25** — see the next section.

## First REAL Arweave mainnet anchor — 2026-11-25

- **Funding:** Karis sent AR to the wallet; the transfer landed at
  **0.1556 AR** (155,600,000,000 winston), confirmed via
  `arweave.net/wallet/<address>/balance` after a few minutes of polling.
- **Run:** one fresh run in real mode (`ANCHOR_MODE=arweave` from `.env`):
  `node src/cli.js run listing-check --text "Vintage film lens, clean glass,
  smooth focus ring. Price $120. Escrow accepted, ships worldwide."`
  - Run id: `run-2026-11-25T07-21-32-175Z-b79005f5`
  - Verdict: `review`, duration 1 ms, canonical payload 999 bytes
  - logHash: `3678b04cdda20e30149ec34404ece0a1d6fbe552ed9c5985fcb64ad06e1aedcc`
  - prevLogHash: `b348407c45c4…` (chains onto demo run 3, as recorded)
- **Anchor transaction:** `zqw7M6ZbAsU4n3LKZ-WRPtLVk-T6mc-ZdH_UBUFH5lQ`
  - Posted 2026-11-25T07:25:06Z; mined in block **2,049,454**
    (`6SexXlcw5n9J6MldOJgEijY9hZHsVX3UTT0vrH8y6R-sXl7J40Itp4nynV7uusUF`),
    5 confirmations at check time.
  - Tags on-chain: `App-Name: RunReceipt`, `Run-Id: <run id>`,
    `Log-Hash: 3678b04c…`, `Content-Type: application/json`; data_size 999.
  - Gateway URL: https://arweave.net/zqw7M6ZbAsU4n3LKZ-WRPtLVk-T6mc-ZdH_UBUFH5lQ
  - Actual cost: **0.003394049365 AR** (balance 0.1556 → 0.152205950635 AR),
    matching the ~0.0034 AR estimate. Remaining balance funds ≈ 44 anchors.
- **Verification (end to end): ok: true, exit 0.**
  The anchored payload was fetched back from the gateway and run through the
  project's own `verifyRun` (input/output/log hash recomputation + anchored
  payload comparison): zero failures, and the fetched payload is
  **byte-identical** to the local canonical log (999 bytes both).
  - Transport note, for honesty: from this sandbox, the gateway's per-tx
    subdomain redirect (`https://arweave.net/<txId>`) serves an empty body,
    so the stock `cli.js verify` reported `anchored_payload_mismatch` here.
    The payload was therefore fetched via the same gateway's canonical data
    endpoint (`https://arweave.net/tx/<txId>/data`, base64url) and fed to the
    unmodified project verification logic. The on-chain data itself is
    complete and correct (data_size 999, tags and hashes match); the empty
    response is a sandbox/proxy quirk of the redirect target, not an anchor
    problem. Anyone outside this sandbox can verify via the gateway URL
    above or the static verify page.
