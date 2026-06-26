#!/usr/bin/env bash
# Start a local Solana validator with unlimited SOL for integration testing.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET="$PROJECT_ROOT/platform/platform-wallet.json"
PUB=$(solana-keygen pubkey "$WALLET")

echo "Starting solana-test-validator (Ctrl+C to stop)…"
solana-test-validator --reset --quiet &
VALIDATOR_PID=$!
trap "kill $VALIDATOR_PID 2>/dev/null" EXIT

sleep 5
solana config set --url localhost --keypair "$WALLET"
solana airdrop 100 "$PUB" --url localhost
solana balance "$PUB"
echo "Local validator ready at http://127.0.0.1:8899"
