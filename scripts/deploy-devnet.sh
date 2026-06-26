#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"

WALLET="$PROJECT_ROOT/platform/platform-wallet.json"
PROGRAM_KP="$PROJECT_ROOT/target/deploy/predict_market-keypair.json"

echo "=== predict_market devnet deploy ==="
solana config set --url devnet --keypair "$WALLET"
solana address
solana balance

echo "Building program (cargo build-sbf)…"
cargo build-sbf --manifest-path programs/predict-market/Cargo.toml

SO_PATH="$PROJECT_ROOT/target/deploy/predict_market.so"
if [[ ! -f "$SO_PATH" ]]; then
  SO_PATH="$PROJECT_ROOT/target/sbf-solana-solana/release/predict_market.so"
fi

if [[ ! -f "$SO_PATH" ]]; then
  echo "Build output not found. Checked target/deploy and target/sbf-solana-solana/release"
  exit 1
fi

echo "Deploying from $SO_PATH"
solana program deploy "$SO_PATH" \
  --program-id "$PROGRAM_KP" \
  --keypair "$WALLET" \
  --url devnet

echo "Program ID: $(solana-keygen pubkey "$PROGRAM_KP")"
