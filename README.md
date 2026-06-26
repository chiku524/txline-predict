# TxLINE Predict

Verifiable World Cup prediction markets on Solana — built for the [Superteam Earn × TxLINE hackathon](https://superteam.fun/earn/listing/prediction-markets-and-settlement).

Stake USDC in peer-to-peer pools, watch live match data from TxLINE SSE streams, and settle winners trustlessly via on-chain Merkle proof validation.

## Features

- **Live match dashboard** — scores, phases, and fixture status from TxLINE
- **Auto-generated markets** — match winner, totals, and prop bets across the tournament
- **SSE live feed** — real-time odds and score updates proxied through Next.js API routes
- **Verifiable resolution UI** — display TxLINE Merkle proof receipts on settled markets
- **Anchor escrow program** — USDC pools with CPI settlement into TxLINE `validate_stat` (WIP)

## Quick start

```bash
# Install dependencies
npm install

# Copy env and optionally add your TxLINE API token
cp apps/web/.env.example apps/web/.env.local

# Run the web app (demo data works out of the box)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### TxLINE API access

Automated setup (platform wallet + on-chain subscribe + token activation):

```bash
# 1. Generate platform wallet (once)
npm run wallet:generate

# 2. Fund the printed address with ≥ 0.01 SOL on mainnet

# 3. Subscribe to free World Cup tier and activate API token
npm run txline:setup
```

This writes `apps/web/.env.local` and `platform/credentials.json` (both gitignored).

Manual steps: see [platform/README.md](platform/README.md) and the [World Cup free tier docs](https://txline.txodds.com/documentation/worldcup).

## Project structure

```
txline-predict/
├── apps/web/              # Next.js 15 frontend + API routes
├── packages/txline-client # TxLINE auth, streams, shared types
├── programs/predict-market/  # Anchor escrow + settlement program
└── docs/TECHNICAL.md      # Hackathon submission technical overview
```

## TxLINE endpoints used

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/guest/start` | Guest JWT for subscription activation |
| `POST /api/token/activate` | Activate API token after on-chain subscribe |
| `GET /api/guest/odds/snapshot` | Consensus odds for market pricing |
| `GET /api/guest/odds/stream` | SSE live odds feed |
| `GET /api/guest/scores/snapshot` | Match scores and events |
| `GET /api/guest/scores/stream` | SSE live scores feed |
| TxLINE `validate_stat` CPI | On-chain settlement verification (program WIP) |

## Smart contract (devnet)

USDC escrow program: `programs/predict-market` — create market vault, deposit per outcome, settle via TxLINE CPI (WIP).

```bash
anchor build && anchor deploy --provider.cluster devnet
```

See [docs/DEPLOY_PROGRAM.md](docs/DEPLOY_PROGRAM.md). Program ID: `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3`

After deploy, connect wallet on `/markets` and use **Back {outcome}** to deposit devnet USDC.

## Hackathon submission checklist

- [ ] Deploy web app (Vercel / similar)
- [ ] Deploy Anchor program to devnet
- [ ] Record 5-min demo video (Loom/YouTube)
- [ ] Fill submission form on Superteam Earn
- [ ] Complete `docs/TECHNICAL.md` feedback section

## License

MIT
