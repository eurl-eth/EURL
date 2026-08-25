import { QueryClient } from '@tanstack/react-query'
import { createConfig, http } from 'wagmi'
import { injected, metaMask, walletConnect } from 'wagmi/connectors'
import { config } from './config/app'
import { CHAINS, wagmiChains } from './config/chains'

const transports = Object.fromEntries(CHAINS.map((c) => [c.chainId, http(c.rpcs[0])])) as Record<
  number,
  ReturnType<typeof http>
>

export const wagmiConfig = createConfig({
  chains: wagmiChains,
  connectors: [
    metaMask(),
    injected(),
    ...(config.wcProjectId
      ? [walletConnect({ projectId: config.wcProjectId, showQrModal: true })]
      : []),
  ],
  transports,
})

export const queryClient = new QueryClient()
