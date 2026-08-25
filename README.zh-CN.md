# EURL — 无合约链上短链接系统

[English](./README.md) | 简体中文

一个生产可用的**完全不需要智能合约的区块链短链接服务**：把目标 URL 写入一笔普通 EVM 交易的 **calldata**，用**「链前缀 + 区块高度 + 交易序号」**的短编码作为短码。解析端（浏览器前端）通过公共 RPC 直接读取链上数据——**不依赖任何服务端**。

---

## 特性

- **无合约、无服务端数据库** – URL 永存于交易 calldata。
- **多链** – 19 条网络（Base / Arbitrum One / Optimism / Ethereum Mainnet / BNB(BSC) / Polygon / Gnosis / AVAX-C / Unichain / Linea / Celo / Mantle / World / Ink / Monad / Plasma，另含 Sepolia / Hoodi / Ephemery 测试网）。
- **安全中间页** – 查询状态 → 安全检测（MetaMask 钓鱼名单 + 可选 Google Safe Browsing）→ 倒计时跳转。
- **可选小费** – 默认免费；配置了存钱罐合约的链支持小费。
- **运行时配置** – 多数配置在 `config.json`，改配置**无需重新编译**。
- **私有部署** – 钱包白名单、链白/黑名单、可更新的黑名单仓库（`github.com/eurl-eth/blocklist`）。
- 中英双语界面。

---

## 快速开始

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run build        # 产物在 dist/
```

连接钱包，粘贴任意 `http(s)` URL，选择链，发送交易。生成的短链接直接从链上解析——无需账号，任何人可验证。

---

## 工作原理

```
创建:  输入 URL → 校验（scheme / 长度 / 黑名单）
     → 签名并广播 { to: 烧毁地址或存钱罐, data: hex("EURL:U1:<url>") }
     → 短码 = base58((blockNumber << 16) | txIndex)

解析:  GET /:prefix/:id  （或 /c/:chainId/:id）
     → 通过公共 RPC 按 (block, index) 找到交易
     → 从 tx.input 读取 URL，剥离 "<app>:U<ver>:" 前缀
     → 安全检查 → 倒计时跳转（可取消）
```

因为 URL 存于普通转账交易的 calldata，所以**没有代币、没有合约、无合约可抽干**。数据与链一样永久。

---

## 短码算法

```text
唯一键: (chainId, blockNumber, transactionIndex)

packed = (blockNumber << 16) | transactionIndex      # txIndex < 65536
short  = base58(packed)                              # Bitcoin 字母表
```

- 今天 Arbitrum（~4.93 亿块）短码 8 字符；即使按 10 块/秒的极端假设增长 100 年也只有 9 字符。
- 若某区块交易数 ≥ 65536，自动回退为点分格式 `base58(block).base58(txIndex)`；解码时见 `.` 即走回退分支，永久无歧义。
- 未知链回退路径：`/c/<base58(chainId)>/<id>`（如 Base 8453 → `/c/3Wk/…`；解码时纯数字按十进制兼容解析）。

| 场景 | 短码长度 |
|------|---------|
| Arbitrum 今天 | 8 |
| 100 年后最坏假设（10 块/秒） | 9 |

### 反解工具

根目录 `query.html` 是一个**零依赖**的短码反解工具。它在本地解码 base58 短码，显示链、区块号、交易序号、打包值（十进制 + hex），并提供对应区块浏览器的链接。不发送任何网络请求。

```text
b/7Kx2mPq9            → 前缀 / 短码
/c/3Wk/7Kx2mPq9       → 通用链 ID 形式
xx.yy                 → 点分回退格式（区块.序号）
```

---

## Calldata 格式

```text
写入: data = hex(utf8("EURL:U1:https://example.com"))
解析: 剥离可选的 "<应用名>:U<版本>:" 前缀 → 必须为 http/https URL，否则拒绝跳转
```

- 应用名可配置；解析端对任意应用名/版本号前缀都兼容剥离。
- 无前缀的裸 URL calldata 同样可解析（向后兼容）。
- Gas：calldata 每非零字节约 16 gas，L2 上整笔交易通常不到 1 美分。

### 交易接收地址

携带 calldata 的转账交易，接收地址必须为**非 EOA**（Arbitrum 禁止向无代码的 EOA 发送带 `data` 的交易；钱包也会拒绝批准「EOA + calldata」）。

- **无小费（默认）**：`to = dataRecipient`，默认 `0x000…dEaD`（著名的 burn 地址，无代码）。实测 MetaMask 在主网/Base/Arbitrum 全部放行。
  - 注意：零地址 `0x000…0000` 会被 MetaMask 拒绝批准，故默认使用 `dEaD`。
- **有小费**：`to = 该链的 tipAddress`（存钱罐合约），`value = 小费`，`data = URL`。小费与数据随同一笔交易进入存钱罐，拥有者可提取余额。
  - 存钱罐合约见 `contracts/Echo.sol` 的 `PiggyBank`。
  - 每链独立配置 `tipAddress`（`src/config/chains.ts`）；未配置的链不显示小费功能。

---

## 配置参考

配置分**两层**——环境变量是构建时默认值，`/config.json`（静态托管）在**运行时以更高优先级覆盖**。改 `config.json` 后重新部署即可生效，**无需重新编译**。

### 运行时配置（`public/config.json`）

| 键 | 默认值 | 说明 |
|-----|---------|------|
| `appName` | `"EURL"` | 写入 calldata 前缀的应用名 |
| `callDataVersion` | `"U1"` | 编码版本号 |
| `defaultPrefix` | `"b"` | 创建页默认选中的链 |
| `wcProjectId` | `""` | WalletConnect Cloud 项目 ID（空 = 仅注入式钱包） |
| `gsbApiKey` | `""` | Google Safe Browsing v5 API Key（空 = 仅钓鱼名单 + 本地规则） |
| `gsbUrl` | `""` | GSB 端点覆盖（例如带 CDN 缓存的镜像） |
| `mainChainPrefixes` | `["b","a","e","s"]` | 直接显示为 chips 的链；其余进入「更多」弹框 |
| `linkDomains` | `[]` | 可选链接域名（每个域名都需指向本应用） |
| `walletWhitelist` | `[]` | 私有模式：仅这些钱包可创建/解析（空 = 所有人） |
| `hiddenChains` | `[]` | 创建页隐藏的链前缀（仍可解析） |
| `chainWhitelist` | `[]` | 私有模式：仅这些链可用（空 = 全部） |
| `chainBlacklist` | `[]` | 禁止的链前缀（不可创建或跳转） |
| `maxUrlLength` | `2000` | URL 最大长度（字符） |
| `redirectCountdownSeconds` | `3` | 跳转前倒计时秒数 |
| `rpcTimeoutMs` | `10000` | RPC 请求超时 |
| `showTestnets` | `true` | 是否在选择器显示测试网 |
| `rpcProxyUrl` | `""` | 可选 RPC 代理（作为每条链的首选端点） |
| `dataRecipient` | `0x000…dEaD` | 无小费时的交易接收地址 |
| `hideBlockedUrl` | `false` | 被拦截页面是否隐藏目标 URL |

### 环境变量（`env` 层）

构建时默认值，被 `config.json` 覆盖：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `VITE_APP_NAME` | `EURL` | calldata 前缀中的应用名 |
| `VITE_WC_PROJECT_ID` | — | WalletConnect Cloud 项目 ID |
| `VITE_GSB_API_KEY` | — | Google Safe Browsing v5 API Key |
| `VITE_GSB_URL` | — | GSB 端点覆盖 |
| `VITE_LINK_DOMAINS` | — | 逗号分隔的链接域名 |
| `VITE_WALLET_WHITELIST` | — | 逗号分隔的允许钱包（小写 hex） |
| `VITE_HIDDEN_CHAINS` | — | 逗号分隔的隐藏链前缀 |
| `VITE_MAIN_CHAINS` | — | 逗号分隔的 chips 链前缀 |
| `VITE_CHAIN_WHITELIST` | — | 逗号分隔的允许链前缀 |
| `VITE_CHAIN_BLACKLIST` | — | 逗号分隔的禁止链前缀 |

### 链（`src/config/chains.ts`）

每条链一个条目：短前缀、chainId、名称、RPC 列表（按顺序故障切换）、浏览器、品牌色。新增链只需追加一项（含 viem chain 定义）。当前：

| 前缀 | 链 | ID | 测试网 |
|------|-----|----|--------|
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

配置了 `faucetUrl` 的测试网，创建页/解析页会显示「获取免费测试网 ETH」链接。

---

## 安全检测策略

按顺序执行，外部服务不可用时安全降级：

1. **本地规则** – scheme 白名单（http/https）、长度上限、控制字符、禁止内嵌凭据。
2. **MetaMask 钓鱼名单** – 公开 `eth-phishing-detect`，本地缓存 1 小时。
3. **Google Safe Browsing v5** – 仅配置 `gsbApiKey`/`gsbUrl` 时启用。
4. **黑名单（`github.com/eurl-eth/blocklist`）** – 社区维护的名单，由前端在运行时获取（GitHub tree API，localStorage 缓存 1 小时）：

```
a/<code>.json                → 封禁某个短码
target/<host>.json           → 封禁某个主机（含子域）
target/<host>/<path>.json    → 封禁某个路径前缀
wallet/<0x…>.json            → 封禁某个钱包地址（创建 + 跳转）
```

判定：

- 命中（安全检测或黑名单）→ 阻止跳转并显示原因（可用 `hideBlockedUrl` 隐藏目标 URL）。
- 所有外部检测不可用 → 提示「无法完成安全检查」，需用户勾选确认后才可继续。
- 全部通过 → 倒计时跳转（可取消）。

黑名单条目通过向 `github.com/eurl-eth/blocklist` 提交 PR 添加。

---

## 自行部署

`dist/` 为纯静态文件，无服务端依赖；任意静态托管均可（Cloudflare Workers/Pages、Netlify、Vercel、Nginx）。未知路径需配置 SPA 回退（仓库已含 `_redirects`，适用于 Netlify/Cloudflare Pages）。

### 1. 准备配置

```bash
cp .env.example .env      # 可选：构建时默认值
# 或编辑 public/config.json（推荐，后续改动无需重新编译）
```

### 2. Cloudflare Workers（wrangler）

```bash
npm install
npm run build

# 先写入账号凭据：
export CLOUDFLARE_ACCOUNT_ID=your-account-id
export CLOUDFLARE_API_TOKEN=your-api-token

npm exec --yes wrangler@latest -- deploy
```

`wrangler.jsonc` 使用 `assets.directory = ./dist/` + `single-page-application` 回退。部署后访问 `https://<name>.<account>.workers.dev`。

> 之后改配置：编辑 `public/config.json` → 重新构建部署即可，无需改代码。

### 3. 自定义域名

把域名解析指向该 Worker，并在 `config.json` 的 `linkDomains` 中加入，使生成的链接使用该域名。

### 4.（可选）RPC 代理

`proxy/` 是纯透传 JSON-RPC 的 Cloudflare Worker（解决 CORS/限流，对不可变区块读取加一年 CDN 缓存），不存储任何短链映射。

```bash
cd proxy
npm install
npm run deploy            # https://<name>.<account>.workers.dev
```

然后在 `config.json` 中设置 `rpcProxyUrl`，作为每条链的首选端点。

### 5. 私有部署（可选）

- 设置 `walletWhitelist` 仅允许指定钱包创建和解析。
- 设置 `chainWhitelist`/`chainBlacklist` 限制可用的链。
- 设置 `hideBlockedUrl: true` 永不展示被拦截的目标。

私有部署如需完全自包含的单个文件，`npm run build:single` 可将整个应用打包为单个 `eurl.html`（hash 路由 + 内联字体，约 2.7 MB），可直接双击打开（`file://`）或部署到任意静态托管而无需 SPA 回退：

```bash
npm run build:single        # 输出 dist-single/ 并复制为仓库根目录的 eurl.html
```

默认的 `npm run build` 仍产出常规多文件 `dist/`——单文件配置（`vite.singlefile.config.ts`）仅在执行 `build:single` 时生效。

### 路由表

| 路径 | 功能 |
|------|------|
| `/` | 生成页 |
| `/:prefix/:id` | 解析（中间页 → 跳转） |
| `/c/:chainId/:id` | 通用 chainId 回退解析（Base58 编码，兼容十进制） |
| `/about` | 原理与风险说明 |

---

## 项目结构

```
eurl/
├── src/
│   ├── config/            # app.ts（运行时配置）、chains.ts（链注册表）
│   ├── lib/               # calldata 编解码、base58/id、rpc、safety、blocklist、access、tip
│   ├── pages/             # CreatePage、ResolvePage、PendingPage、AboutPage
│   └── components/        # Layout、弹框、图标
├── public/                # config.json、robots.txt、sitemap.xml、llms.txt、skills/
├── proxy/                 # 可选 JSON-RPC 透传 Cloudflare Worker
├── contracts/             # Echo.sol（可选 PiggyBank 小费合约）
├── scripts/               # 部署辅助
└── wrangler.jsonc         # Cloudflare Workers assets 部署
```

---

## 安全建议

- 如非必须，保持 `hideBlockedUrl: false`；私有部署可开启以隐藏目标。
- 私有部署建议同时使用 `walletWhitelist` 与 `chainWhitelist`/`chainBlacklist`。
- 运行时改动优先走 `config.json` 层；密钥（RPC Key、API Key）放 `env` 层或服务端。
- 安全检测尽力而为，无法保证 100% 覆盖；请认真对待风险提示。

---

## License

MIT
