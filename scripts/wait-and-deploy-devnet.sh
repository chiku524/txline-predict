#!/usr/bin/env bash
# Poll devnet SOL balance; deploy predict_market when funded.
set -euo pipefail
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
PROJECT="$(cd "$(dirname "$0")/.." && pwd)"
WALLET="$PROJECT/platform/platform-wallet.json"
PUB=$(solana-keygen pubkey "$WALLET")
TARGET_SOL="${1:-0.5}"

echo "Waiting for >= ${TARGET_SOL} SOL on devnet for $PUB"
echo "Fund at https://faucet.solana.com/ (complete captcha if prompted)"
echo ""

for i in $(seq 1 120); do
  BAL=$(solana balance "$PUB" --url devnet 2>/dev/null | awk '{print $1}')
  echo "[$i] balance: ${BAL:-0} SOL"
  if awk -v b="${BAL:-0}" -v t="$TARGET_SOL" 'BEGIN { exit !(b >= t) }'; then
    echo "Funded — deploying…"
    bash "$PROJECT/scripts/deploy-devnet.sh"
    exit 0
  fi
  sleep 10
done

echo "Timed out after 20 minutes. Run: npm run devnet:deploy"
exit 1
