# Deployment status

## Platform wallet (same keypair on all clusters)

`HNpuagxtPsr1ZucA4B5CfjaqqobwMn9usncv5G5dFkQb`

| Cluster | SOL | Status |
|---------|-----|--------|
| Mainnet | ~0.014 | TxLINE subscription active |
| Devnet | ~5 SOL | Funded via faucet ✓ |
| Localhost | Unlimited | Verified via `scripts/setup-local-dev.sh` |

## predict_market program

| Cluster | Program ID | Status |
|---------|------------|--------|
| **Localhost** | `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3` | Deployed ✓ |
| **Devnet** | `47BEuEzRc1Aj6QAZvYkuebLSqGRAcKnLs8HLuW8Gc5e3` | Deployed ✓ (`rUCfkppG6npxSfFdWd2U7MSd2TkWoPVR12Ec2VLi9n6dDGtX4ywfVu2bbPmc9heH63Nr1cfuo5bE3sF3fLoVTpP`) |

## Fund devnet (manual step — captcha required)

1. **SOL** — https://faucet.solana.com/
   - Paste platform wallet address
   - Select 5 SOL → Confirm (complete Cloudflare captcha)
2. **USDC** — https://faucet.circle.com/
   - Network: **Solana Devnet**
   - Paste platform wallet → Send 20 USDC (complete reCAPTCHA)

Then deploy:

```bash
wsl bash scripts/deploy-devnet.sh
```

Or from Git Bash after Solana CLI is configured:

```bash
npm run devnet:deploy
```

## Local testing (no faucet limits)

```bash
wsl bash scripts/setup-local-dev.sh
```

Keeps `solana-test-validator` running with deployed program + 10,000 test USDC.
