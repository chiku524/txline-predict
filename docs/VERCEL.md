# Vercel deployment

| Setting | Value |
|---------|--------|
| Project | [txline-predict](https://vercel.com/nico-builds/txline-predict) |
| Production URL | https://txline-predict.vercel.app |
| GitHub | `chiku524/txline-predict` → `main` auto-deploy |
| Root directory | `apps/web` |

## Environment variables (Vercel dashboard)

Configured on the project:

- `TXLINE_API_TOKEN` — server-only (live TxLINE data)
- `NEXT_PUBLIC_SOLANA_NETWORK=devnet`
- `NEXT_PUBLIC_PREDICT_MARKET_PROGRAM_ID=47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3`
- `NEXT_PUBLIC_USE_DEMO_DATA=false`

## Browser testing

1. Open https://txline-predict.vercel.app
2. Set Phantom (or Solflare) to **Devnet**
3. Fund your personal wallet with devnet SOL + USDC (faucets in `platform/DEPLOYMENT.md`)
4. Connect wallet → browse markets → test a USDC deposit

Pushes to `main` trigger a new production deployment automatically.
