/**
 * EURL Echo 合约部署脚本
 *
 * 部署极简 Echo 合约到指定链，地址写入 src/config/app.ts 的 DATA_RECIPIENT。
 * Echo 只承载 calldata（value=0），不收款。
 *
 * 如需小费存钱罐（可收 value + 提款），请编译 contracts/Echo.sol 的 PiggyBank 合约
 * 部署后填入对应链配置的 tipAddress。
 *
 * 用法:
 *   DEPLOY_PK=<私钥> node scripts/deploy-echo.mjs <chainId>
 *
 * 例:
 *   DEPLOY_PK=0x... node scripts/deploy-echo.mjs 8453
 *
 * 支持 chainId: 1(ETH) 8453(Base) 42161(Arbitrum) 10(OP)
 * 也支持测试网: 84532(Base Sepolia) 421614(Arbitrum Sepolia) 11155111(Sepolia)
 */
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { deployContract, waitForTransactionReceipt } from 'viem/actions'
import { mainnet, base, arbitrum, optimism, baseSepolia, arbitrumSepolia, sepolia } from 'viem/chains'

const CHAIN_BY_ID = {
  1: { chain: mainnet, rpc: 'https://ethereum-rpc.publicnode.com' },
  8453: { chain: base, rpc: 'https://mainnet.base.org' },
  42161: { chain: arbitrum, rpc: 'https://arb1.arbitrum.io/rpc' },
  10: { chain: optimism, rpc: 'https://mainnet.optimism.io' },
  84532: { chain: baseSepolia, rpc: 'https://sepolia.base.org' },
  421614: { chain: arbitrumSepolia, rpc: 'https://sepolia-rollup.arbitrum.io/rpc' },
  11155111: { chain: sepolia, rpc: 'https://ethereum-sepolia-rpc.publicnode.com' },
}

const chainId = Number(process.argv[2])
const cfg = CHAIN_BY_ID[chainId]
if (!cfg) {
  console.error('不支持 chainId，可选: 1, 8453, 42161, 10, 84532, 421614, 11155111')
  process.exit(1)
}
const pk = process.env.DEPLOY_PK
if (!pk) {
  console.error('请设置 DEPLOY_PK 环境变量')
  process.exit(1)
}

// 运行时字节码: 0x00 (STOP) - 空 fallback，接受任意 calldata 且无副作用
// 创建字节码: 60 01 60 0c 60 00 39 60 01 60 00 f3 00
//   PUSH1 0x01  PUSH1 0x0c  PUSH1 0x00  CODECOPY  PUSH1 0x01  PUSH1 0x00  RETURN  STOP
const initCode = '0x6001600c60003960016000f300'

const account = privateKeyToAccount(pk)
const client = createWalletClient({ chain: cfg.chain, transport: http(cfg.rpc) })

const hash = await deployContract(client, { account, bytecode: initCode })
console.log('部署交易:', hash)

const receipt = await waitForTransactionReceipt(client, { hash })
console.log('Echo 合约地址:', receipt.contractAddress)
console.log(`已部署到 ${cfg.chain.name}。请将地址填入 src/config/app.ts 的 DATA_RECIPIENT`)
