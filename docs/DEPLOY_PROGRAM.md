# Deploy `predict_market` to Solana devnet

## Prerequisites

- [WSL2 + Ubuntu](https://learn.microsoft.com/en-us/windows/wsl/install) (required on Windows)
- Solana CLI inside WSL (`solana --version` should work in Ubuntu)
- [Anchor 0.30.1](https://www.anchor-lang.com/docs/installation) (optional; deploy script uses `cargo build-sbf`)
- Devnet SOL in your deploy wallet

### Windows (Git Bash / PowerShell)

**Do not run `solana` or `anchor build` in Git Bash** — the Solana installer does not support native Windows (`agave-install-init: machine architecture is currently unsupported`).

Use WSL instead. This repo already wraps deploy:

```bash
npm run devnet:deploy
```

Or directly:

```bash
wsl bash scripts/deploy-devnet.sh
```

Install Solana inside Ubuntu (one-time):

```bash
wsl
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
echo 'export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
solana --version
```

## Steps (Linux / macOS / WSL)

```bash
# From WSL or Linux/macOS terminal
cd /mnt/c/Users/chiku/Desktop/vibe-code/txline-predict   # adjust path on WSL

# Point CLI at devnet
solana config set --url devnet

# Use platform wallet or default ~/.config/solana/id.json
export ANCHOR_WALLET=platform/platform-wallet.json

# Preferred: build + deploy via project script
bash scripts/deploy-devnet.sh

# Or manually:
cargo build-sbf --manifest-path programs/predict-market/Cargo.toml
solana program deploy target/deploy/predict_market.so \
  --program-id target/deploy/predict_market-keypair.json \
  --keypair platform/platform-wallet.json \
  --url devnet
```

Program ID (declared in `lib.rs`): `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3`

After deploy, set in `apps/web/.env.local`:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PREDICT_MARKET_PROGRAM_ID=47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3
```

Users need devnet USDC (`4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`) to deposit.
