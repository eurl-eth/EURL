/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WC_PROJECT_ID?: string
  readonly VITE_GSB_API_KEY?: string
  readonly VITE_GSB_URL?: string
  readonly VITE_APP_NAME?: string
  readonly VITE_LINK_DOMAINS?: string
  readonly VITE_WALLET_WHITELIST?: string
  readonly VITE_HIDDEN_CHAINS?: string
  readonly VITE_MAIN_CHAINS?: string
  readonly VITE_CHAIN_WHITELIST?: string
  readonly VITE_CHAIN_BLACKLIST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
