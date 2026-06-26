#!/usr/bin/env bash
# Full local stack: validator + program deploy + test USDC mint.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET="$PROJECT/platform/platform-wallet.json"
PUB=$(solana-keygen pubkey "$WALLET")
SO="$PROJECT/target/deploy/predict_market.so"
KP="$PROJECT/target/deploy/predict_market-keypair.json"

pkill -f solana-test-validator 2>/dev/null || true
solana-test-validator --reset --quiet &
sleep 8
solana config set --url localhost --keypair "$WALLET"
solana airdrop 100 "$PUB" >/dev/null

echo "Deploying program to localhost…"
solana program deploy "$SO" --program-id "$KP" --keypair "$WALLET" --url localhost

echo "Creating local test USDC mint…"
CREATE_OUT=$(spl-token create-token --decimals 6 --url localhost 2>&1)
MINT=$(echo "$CREATE_OUT" | grep -oE '[1-9A-HJ-NP-Za-km-z]{32,44}' | head -1)
if [[ -z "$MINT" ]]; then
  echo "$CREATE_OUT"
  echo "Failed to parse mint address"
  exit 1
fi
spl-token create-account "$MINT" --owner "$PUB" --url localhost
spl-token mint "$MINT" 10000 "$PUB" --url localhost --fund-recipient
echo "$MINT" > "$PROJECT/platform/local-usdc-mint.txt"

echo ""
echo "Local dev ready:"
echo "  RPC: http://127.0.0.1:8899"
echo "  Program: $(solana-keygen pubkey "$KP")"
echo "  USDC mint: $MINT"
echo "  Wallet: $PUB"
echo ""
echo "Add to apps/web/.env.local:"
echo "  NEXT_PUBLIC_SOLANA_NETWORK=devnet"
echo "  NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8899"
echo "  NEXT_PUBLIC_USDC_MINT=$MINT"
echo "  NEXT_PUBLIC_PREDICT_MARKET_PROGRAM_ID=$(solana-keygen pubkey "$KP")"
