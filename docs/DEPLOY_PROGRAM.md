# Deploy `predict_market` to Solana devnet

## Prerequisites

- [Solana CLI](https://solana.com/docs/intro/installation) (`solana`, `cargo-build-sbf`)
- [Anchor 0.30.1](https://www.anchor-lang.com/docs/installation)
- Devnet SOL in your deploy wallet

## Steps

```bash
# Point CLI at devnet
solana config set --url devnet

# Use platform wallet or default ~/.config/solana/id.json
export ANCHOR_WALLET=platform/platform-wallet.json

# Build + deploy
anchor build
anchor deploy --provider.cluster devnet
```

Program ID (declared in `lib.rs`): `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3`

After deploy, set in `apps/web/.env.local`:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PREDICT_MARKET_PROGRAM_ID=47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3
```

Users need devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) to deposit.
