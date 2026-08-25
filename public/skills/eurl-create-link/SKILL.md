---
name: eurl-create-link
description: Create EURL on-chain short links by writing the target URL into a transaction's calldata. Use when a user wants to create a short link, or needs to compute a short link for a URL, using the EURL (eurl.knowing-sprout.workers.dev) system. Also use to resolve/verify how EURL short codes are encoded from on-chain data.
license: MIT
metadata:
  product: EURL
  homepage: https://eurl.knowing-sprout.workers.dev
---

# EURL Short Link Creation

EURL stores target URLs permanently on-chain inside a plain transaction's `calldata`. There is **no smart contract** involved. Short links live forever in blockchain history.

## How it works

1. The target URL is written into a normal EVM transaction's `data` (calldata) field, prefixed with the EURL marker:
   - Text payload: `EURL:U1:<url>` (ASCII/UTF-8)
   - Calldata = UTF-8 hex encoding of that string. E.g. for `https://example.com`, calldata is the hex of `EURL:U1:https://example.com`.
2. The transaction is mined. Its `(blockNumber, transactionIndex)` uniquely identifies it.
3. The short code is computed: `shortCode = base58((blockNumber << 16) | transactionIndex)`.
   - Fallback when `transactionIndex >= 65536`: `shortCode = base58(blockNumber) + "." + base58(transactionIndex)`.
   - Base58 alphabet: `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`.
4. The short link is: `https://<domain>/<prefix>/<shortCode>` (or `/c/<base58(chainId)>/<shortCode>` for chains without a prefix).

## Two ways to create

### Option A — Use the web UI (browser available)

Open `https://eurl.knowing-sprout.workers.dev/`:

1. Enter the target URL.
2. Pick a blockchain network (chips) or open "More" (弹框) to pick from extra chains. Custom = use the wallet's current network.
3. Optionally pick a short-link domain (default current site; configured domains include `www.com.kg`, `🔗.eu.org` [= `xn--qv8h.eu.org`], `kurl.eu.org`).
4. Set an optional tip via the slider (default $0.10; uncheck "不付小费" for 0).
5. Click "签名并发送交易" (Sign & send) and confirm in the connected wallet.
6. If confirmation times out, the page navigates to `/pending/<prefix>/<txHash>` — click "重新获取交易状态" until the link is generated.

### Option B — Send the transaction yourself (no browser needed)

If the agent has no browser, construct and broadcast the transaction directly:

1. Choose a chain. Prefix → chainId:
   - `b` = Base (8453), `a` = Arbitrum One (42161), `o` = Optimism (10), `e` = Ethereum (1)
   - `q` = BNB Chain (56), `p` = Polygon (137), `g` = Gnosis (100), `x` = AVAX-C (43114)
   - `u` = Unichain (130), `l` = Linea (59144), `n` = Celo (42220), `m` = Mantle (5000)
   - `w` = World Chain (480), `k` = Ink (57073), `d` = Monad (143), `v` = Plasma (9745)
   - `h` = Hoodi testnet (560048), `y` = Ephemery testnet (39438162)
2. Build a transaction with `to` = the EURL dead address `0x000000000000000000000000000000000000dEaD`, `value` = 0 (or tip), and `data` = hex of `EURL:U1:<url>`.
3. Sign it with the wallet (e.g. via WalletConnect projectId `438d993e01dee143ce7113ba39c4437b`, or any injected wallet) and broadcast.
4. Wait for the receipt to get `blockNumber` and `transactionIndex`.
5. Compute the short code as above, then form the link:
   - `https://www.com.kg/<prefix>/<code>` or `https://xn--qv8h.eu.org/<prefix>/<code>` or `https://kurl.eu.org/<prefix>/<code>` (or any of these domains — they all resolve to the same app).

## Notes

- Gas is tiny: ~21000 + 16 gas per non-zero calldata byte. Usually well under $0.002 on L2s.
- Testnets (Sepolia `s`, Hoodi `h`, Ephemery `y`) may be reset; Ephemery clears monthly. Do not use testnet links for anything permanent.
- The app is private-deploy friendly: wallet/chain whitelists are config-driven and do not require an account on the site.
