import React from 'react'
import ReactDOM from 'react-dom/client'
import { loadRuntimeConfig } from './config/app'
import './styles.css'

async function bootstrap() {
  await loadRuntimeConfig()
  const { default: App } = await import('./App')
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

bootstrap()
