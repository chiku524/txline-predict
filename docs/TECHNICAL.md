# Technical Overview — TxLINE Predict

## Core idea

TxLINE Predict is a permissionless prediction market platform for the 2026 FIFA World Cup. Users deposit USDC into on-chain escrow pools to back outcomes (match winner, totals, props). Markets are created from TxLINE fixture and odds data, updated in real time via SSE, and resolved trustlessly when a keeper submits TxLINE Merkle proofs through a CPI into the TxLINE oracle program.

## Architecture

```
┌─────────────┐     SSE / REST      ┌──────────────────┐
│  TxLINE API │ ◄────────────────── │  Next.js API     │
│  (TxODDS)   │                     │  routes (proxy)  │
└─────────────┘                     └────────┬─────────┘
                                             │
                                    ┌────────▼─────────┐
                                    │  React frontend  │
                                    │  (matches,       │
                                    │   markets, feed) │
                                    └────────┬─────────┘
                                             │ wallet txs
                                    ┌────────▼─────────┐
                                    │ predict_market   │
                                    │ Anchor program   │
                                    │ (USDC escrow)    │
                                    └────────┬─────────┘
                                             │ CPI
                                    ┌────────▼─────────┐
                                    │ TxLINE oracle    │
                                    │ validate_stat    │
                                    └──────────────────┘
```

## Business / technical highlights

1. **Data-driven auto-markets** — fixture schedule from TxLINE drives automatic market creation across 104 tournament matches.
2. **No TxLINE token for wagering** — pools use USDC; TxLINE token is only for data subscription per hackathon rules.
3. **Verifiable resolution receipts** — settled markets store and display Merkle root + proof path for auditability.
4. **Demo mode** — judges can explore the full UX without a TxLINE subscription.

## TxLINE endpoints

Base URLs:
- Mainnet API: `https://txline.txodds.com`
- Devnet API: `https://txline-dev.txodds.com`

All data routes below use subscribed `/api/*` paths (not `guest/*`). Requests require `Authorization: Bearer <guest JWT>` and `X-Api-Token: <activated token>`.

| Endpoint | Method | Usage |
|----------|--------|-------|
| `/auth/guest/start` | POST | Obtain guest JWT |
| `/api/token/activate` | POST | Exchange on-chain subscribe tx for API token |
| `/api/fixtures/snapshot` | GET | Fixture metadata (teams, kickoff, competition) |
| `/api/scores/snapshot` | GET | Match scores, status, phase, events |
| `/api/scores/stream` | SSE | Live score and event updates |
| `/api/odds/snapshot` | GET | Bulk consensus odds for market pricing |
| `/api/odds/snapshot/{fixtureId}` | GET | Per-fixture odds fallback |
| `/api/odds/stream` | SSE | Live odds updates |
| `/api/scores/stat-validation` | GET | Merkle proof payload for on-chain `validate_stat` CPI |

On-chain:
- Mainnet program: `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA`
- Devnet program: `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`
- Settlement: permissionless `settle_market` CPI to `validate_stat` with scores Merkle proof
- Claims: `claim` transfers parimutuel share from vault to winning `Position` holders

### Settlement flow

1. Match finishes — TxLINE scores snapshot updates fixture status.
2. Keeper (any wallet) calls `GET /api/txline/settlement?fixtureId=&marketType=` to fetch stat-validation payload + winning outcome.
3. `settle_market` CPIs into TxLINE `validate_stat`, verifies scores, stores settlement root, marks market resolved.
4. Winners call `claim` to withdraw USDC proportional to their stake in the winning outcome pool.

Demo/dev fallback: empty Merkle proof path requires the market authority signer (devnet testing without live oracle proofs).

## Hackathon feedback (fill before submission)

**What we liked most:**
- _(TBD — e.g. normalised schema, free World Cup tier, SSE latency)_

**Where we hit friction:**
- _(TBD — e.g. activation flow, proof retrieval docs, devnet vs mainnet)_

## Deployment

| Component | Target | URL |
|-----------|--------|-----|
| Web app | Vercel | https://txline-predict.vercel.app |
| Smart contract | Solana devnet | `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3` |
| Demo video | YouTube/Loom | _(TBD — required for submission)_ |

### App-internal proxy routes

| Route | Purpose |
|-------|---------|
| `GET /api/txline/stream` | Multiplexed odds + scores SSE for browser |
| `GET /api/txline/fixtures` | Fixtures snapshot (server-side) |
| `GET /api/txline/settlement` | Settlement plan + Merkle proof for keepers |
| `GET /api/markets` | Normalised prediction markets JSON |
