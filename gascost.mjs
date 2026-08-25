const rpcs = {
  'Base': 'https://mainnet.base.org',
  'Arbitrum': 'https://arb1.arbitrum.io/rpc',
  'OP': 'https://mainnet.optimism.io',
}
const DATA = '0x4555524c3a55313a68747470733a2f2f6578616d706c652e636f6d2f'
const from = '0xd3Cc440B8AdBa63F2D25feA900fc16F434a6700c'
const to = '0x000000000000000000000000000000000000dEaD'

async function rpc(url, method, params) {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
    return await r.json()
  } catch { return {} }
}

for (const [name, url] of Object.entries(rpcs)) {
  const est = await rpc(url, 'eth_estimateGas', [{ from, to, data: DATA, value: '0x0' }])
  const price = await rpc(url, 'eth_gasPrice', [])
  if (!est.result || !price.result) { console.log(name, '查询失败'); continue }
  const gas = BigInt(est.result)
  const gp = BigInt(price.result)
  const costWei = gas * gp
  const eth = Number(costWei) / 1e18
  // ETH ~ 3500 USD 估算
  console.log(`${name.padEnd(10)} gas=${gas} gasPrice=${Number(gp)/1e9} gwei  成本≈${eth.toExponential(2)} ETH  ≈$${(eth*3500).toExponential(2)}`)
}
