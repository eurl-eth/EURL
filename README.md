# EURL — Contractless On-Chain Short Links

English | [简体中文](./README.zh-CN.md)

A production-ready **blockchain short-link service that needs no smart contract**. The target URL is written into the **calldata** of an ordinary EVM transaction and referenced by a short code derived from **「chain prefix + block height + transaction index」**. The frontend reads the chain directly over public RPC — **no server involved**.

---

## Highlights

- **No contract, no server database** – URLs live in transaction calldata forever.
- **Multi-chain** – 19 networks (Base / Arbitrum One / Optimism / Ethereum Mainnet / BNB(BSC) / Polygon / Gnosis / AVAX-C / Unichain / Linea / Celo / Mantle / World / Ink / Monad / Plasma, plus Sepolia / Hoodi / Ephemery testnets).
- **Safety gate** – status check → safety detection (MetaMask phishing list + optional Google Safe Browsing) → countdown redirect.
- **Optional tips** – free by default; per-chain tip address (piggy-bank contract) when configured.
- **Runtime configuration** – most settings live in `config.json` and can be changed **without recompiling**.
- **Private deployments** – wallet whitelist, chain whitelist/blacklist, and an updatable blocklist repo (`github.com/eurl-eth/blocklist`).
- Bilingual (English / 简体中文).

---

## Quick Start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # output in dist/
```

Connect a wallet, paste any `http(s)` URL, pick a chain, and send the transaction. The generated short link resolves from the chain itself — anyone can verify it, no account needed.

---

## How It Works

```
Create:  input URL → validate (scheme / length / blocklist)
       → sign & broadcast { to: dead-address-or-piggybank, data: hex("EURL:U1:<url>") }
       → short code = base58((blockNumber << 16) | txIndex)

Resolve: GET /:prefix/:id  (or /c/:chainId/:id)
       → find tx by (block, index) via public RPC
       → read URL from tx.input, strip the "<app>:U<ver>:" prefix
       → safety checks → countdown redirect (cancelable)
```

Because the URL is stored in calldata of a plain value transfer, there is **no token, no contract, and nothing to rug-pull**. The data is as permanent as the chain itself.

---

## Short Code Algorithm

```text
unique key: (chainId, blockNumber, transactionIndex)

packed = (blockNumber << 16) | transactionIndex      # txIndex < 65536
short  = base58(packed)                              # Bitcoin alphabet
```

- Arbitrum today (~493M blocks) → 8 chars; even a 100-year worst case (10 blocks/s) stays at 9.
- If a block has ≥ 65536 transactions, fall back to dotted form `base58(block).base58(txIndex)`; a `.` in the code decodes via the fallback branch, permanently unambiguous.
- Unknown-chain fallback: `/c/<base58(chainId)>/<id>` (Base 8453 → `/c/3Wk/…`; decoding accepts plain decimal).

| Scenario | Length |
|----------|--------|
| Arbitrum today | 8 |
| 100-year worst case (10 blocks/s) | 9 |

---

## Calldata Format

```text
write: data = hex(utf8("EURL:U1:https://example.com"))
read:  strip the optional "<app>:U<ver>:" prefix → must be an http(s) URL, else refuse to redirect
```

- The app name is configurable; the resolver strips prefixes of any app/version for compatibility.
- A bare URL calldata (no prefix) is also resolved (backward compatible).
- Gas: 16 gas per non-zero calldata byte; a full transaction on an L2 is usually under a cent.

### Transaction recipient

A value transfer carrying calldata must target a **non-EOA** address (Arbitrum rejects calldata to code-less EOAs, and wallets refuse to sign "EOA + calldata").

- **No tip (default):** `to = dataRecipient`, default `0x000…dEaD` (the well-known burn address, no code). Verified to be approved by MetaMask on Mainnet / Base / Arbitrum.
  - Note: the zero address `0x000…0000` is rejected by MetaMask, hence `dEaD`.
- **With tip:** `to = chain.tipAddress` (piggy-bank contract), `value = tip`, `data = URL`. Tip and data enter the piggy bank in the same tx; the owner can withdraw.
  - Piggy-bank contract: `contracts/Echo.sol` (`PiggyBank` — accepts arbitrary calldata + value, owner can sweep the balance).
  - Configured per chain via `tipAddress` in `src/config/chains.ts`; chains without one hide the tip UI.

---

## Configuration Reference

All settings come from **two layers** — environment variables are the build-time defaults, and `/config.json` (served statically) **overrides them at runtime** with higher priority. Edit `config.json` and redeploy to change behavior **without recompiling**.

### Runtime config (`public/config.json`)

| Key | Default | Description |
|-----|---------|-------------|
| `appName` | `"EURL"` | App name written into the calldata prefix |
| `callDataVersion` | `"U1"` | Encoding version |
| `defaultPrefix` | `"b"` | Chain selected by default on the create page |
| `wcProjectId` | `""` | WalletConnect Cloud project ID (empty → injected wallets only) |
| `gsbApiKey` | `""` | Google Safe Browsing v5 API key (empty → phishing list + local rules only) |
| `gsbUrl` | `""` | GSB endpoint override (e.g. a CDN-cached mirror) |
| `mainChainPrefixes` | `["b","a","e","s"]` | Chains shown as chips; the rest go behind the "More" picker |
| `linkDomains` | `[]` | Selectable link domains (each must point at this app) |
| `walletWhitelist` | `[]` | Private mode: only these wallets can create/resolve (empty = everyone) |
| `hiddenChains` | `[]` | Chain prefixes hidden from the create-page selector (still resolvable) |
| `chainWhitelist` | `[]` | Private mode: only these chains can be used (empty = all) |
| `chainBlacklist` | `[]` | Blocked chain prefixes (cannot create or redirect) |
| `maxUrlLength` | `2000` | Max URL length (chars) |
| `redirectCountdownSeconds` | `3` | Countdown before auto-redirect |
| `rpcTimeoutMs` | `10000` | RPC request timeout |
| `showTestnets` | `true` | Show testnets in the selector |
| `rpcProxyUrl` | `""` | Optional RPC proxy (used as the preferred endpoint per chain) |
| `dataRecipient` | `0x000…dEaD` | Recipient when no tip is paid |
| `hideBlockedUrl` | `false` | Hide the target URL on the blocked page |

### Environment variables (`env` layer)

Build-time defaults, superseded by `config.json`:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_APP_NAME` | `EURL` | App name in the calldata prefix |
| `VITE_WC_PROJECT_ID` | — | WalletConnect Cloud project ID |
| `VITE_GSB_API_KEY` | — | Google Safe Browsing v5 API key |
| `VITE_GSB_URL` | — | GSB endpoint override |
| `VITE_LINK_DOMAINS` | — | Comma-separated link domains |
| `VITE_WALLET_WHITELIST` | — | Comma-separated allowed wallets (lowercase hex) |
| `VITE_HIDDEN_CHAINS` | — | Comma-separated hidden chain prefixes |
| `VITE_MAIN_CHAINS` | — | Comma-separated chip chain prefixes |
| `VITE_CHAIN_WHITELIST` | — | Comma-separated allowed chain prefixes |
| `VITE_CHAIN_BLACKLIST` | — | Comma-separated blocked chain prefixes |

### Chains (`src/config/chains.ts`)

Each entry: short prefix, chainId, name, RPC list (fault-tolerant failover), explorer, brand color. Add a network by appending one item (with its viem chain). Currently:

| Prefix | Chain | ID | Testnet |
|--------|-------|----|---------|
| `b` | Base | 8453 | |
| `a` | Arbitrum One | 42161 | |
| `o` | Optimism | 10 | |
| `e` | Ethereum Mainnet | 1 | |
| `s` | Sepolia | 11155111 | ✓ |
| `q` | BNB(BSC) | 56 | |
| `p` | Polygon | 137 | |
| `g` | Gnosis | 100 | |
| `x` | AVAX-C | 43114 | |
| `u` | Unichain | 130 | |
| `l` | Linea | 59144 | |
| `n` | Celo | 42220 | |
| `m` | Mantle | 5000 | |
| `w` | World | 480 | |
| `k` | Ink | 57073 | |
| `d` | Monad | 143 | |
| `v` | Plasma | 9745 | |
| `h` | Hoodi | 560048 | ✓ |
| `y` | Ephemery | 39438162 | ✓ |

Testnets configured with `faucetUrl` show a "get free testnet ETH" link on the create/resolve pages.

---

## Blocklist (`github.com/eurl-eth/blocklist`)

Community-maintained list consumed by the frontend at runtime (GitHub tree API, 1 h localStorage cache):

```
a/<code>.json                → block a specific short code
target/<host>.json           → block a host (incl. subdomains)
target/<host>/<path>.json    → block a path prefix
wallet/<0x…>.json            → block a wallet address (create + redirect)
```

Hit → the page shows a blocked screen (the target URL can be hidden via `hideBlockedUrl`). Submit entries via PR to the repo.

---

## Safety Detection Strategy

Executed in order, fail-open on service unavailability:

1. **Local rules** – scheme whitelist (http/https), length cap, control chars, no embedded credentials.
2. **MetaMask phishing list** – public `eth-phishing-detect`, cached 1 h locally.
3. **Google Safe Browsing v5** – enabled only when `gsbApiKey`/`gsbUrl` is configured.

Outcomes:

- Hit → block redirect and show the reason.
- All external checks unavailable → "cannot complete safety check", user must confirm to continue.
- All clear → countdown redirect (cancelable).

---

## Deploying Yourself

The build output `dist/` is pure static files with no server dependency; any static host works (Cloudflare Workers/Pages, Netlify, Vercel, Nginx). SPA fallback is required for unknown paths (the repo ships a `_redirects` file for Netlify/Cloudflare Pages).

### 1. Prepare config

```bash
cp .env.example .env      # optional: build-time defaults
# or edit public/config.json (recommended, no recompile needed for later changes)
```

### 2. Cloudflare Workers (wrangler)

```bash
npm install
npm run build

# write your account credentials first:
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token

npm exec --yes wrangler@latest -- deploy
```

`wrangler.jsonc` uses `assets.directory = ./dist/` with `single-page-application` fallback. Your deployment lives at `https://<name>.<account>.workers.dev`.

> To change configuration later, edit `public/config.json`, rebuild, and redeploy — no code changes.

### 3. Custom domain

Point a domain at the Worker, then add it to `linkDomains` in `config.json` so generated links use it.

### 4. (Optional) RPC proxy

`proxy/` is a pure JSON-RPC passthrough Cloudflare Worker (CORS/rate-limit relief, 1-year CDN cache for immutable block reads). It stores no short-link mapping.

```bash
cd proxy
npm install
npm run deploy            # https://<name>.<account>.workers.dev
```

Then set `rpcProxyUrl` in `config.json` to use it as each chain's preferred endpoint.

### 5. Single-file build (optional)

`npm run build:single` compiles the whole app into one self-contained `eurl.html` (hash router + inlined fonts, ~2.7 MB). It works by double-clicking (`file://`) or on any static host with no SPA fallback needed.

```bash
npm run build:single        # writes dist-single/ and copies to eurl.html in the repo root
```

The default `npm run build` still produces the regular multi-file `dist/` — the single-file config (`vite.singlefile.config.ts`) is only used when `build:single` runs.

### 6. Short code decoder

`query.html` (repo root) is a **zero-dependency** short-code decoder. It decodes the base58 code locally and shows the chain, block number, transaction index, and packed value (decimal + hex), plus a link to the matching block explorer page. No network request is made.

```text
b/7Kx2mPq9            → prefix / code
/c/3Wk/7Kx2mPq9       → generic chain ID form
xx.yy                 → dotted fallback format (block.txIndex)
```

### 7. Private deployment (optional)

- Set `walletWhitelist` to allow only specific wallets to create and resolve.
- Set `chainWhitelist`/`chainBlacklist` to restrict which chains are usable.
- Set `hideBlockedUrl: true` to never reveal a blocked target.

### Route table

| Path | Function |
|------|----------|
| `/` | Create page |
| `/:prefix/:id` | Resolve (gateway → redirect) |
| `/c/:chainId/:id` | Generic chainId fallback (Base58, decimal compatible) |
| `/about` | How it works & risks |

---

## Project Structure

```
eurl/
├── src/
│   ├── config/            # app.ts (runtime config), chains.ts (chain registry)
│   ├── lib/               # calldata codec, base58/id, rpc, safety, blocklist, access, tip
│   ├── pages/             # CreatePage, ResolvePage, PendingPage, AboutPage
│   └── components/        # Layout, modals, icons
├── public/                # config.json, robots.txt, sitemap.xml, llms.txt, skills/
├── proxy/                 # optional JSON-RPC passthrough Cloudflare Worker
├── contracts/             # Echo.sol (PiggyBank tip contract, optional)
├── scripts/               # build/deploy helpers (inline-fonts.mjs)
├── eurl.html              # optional single-file build (npm run build:single)
├── query.html             # zero-dependency short-code decoder
└── wrangler.jsonc         # Cloudflare Workers assets deployment
```

---

## Security Recommendations

- Keep `hideBlockedUrl: false` unless you must conceal targets from visitors.
- For private deployments, combine `walletWhitelist` with `chainWhitelist`/`chainBlacklist`.
- Prefer the `config.json` layer for runtime changes; keep secrets (RPC keys, API keys) in the `env` layer or server-side.
- The safety gate is best-effort — it cannot guarantee 100% coverage; treat warnings seriously.

---

## License

MIT
