import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const dir = path.dirname(new URL(import.meta.url).pathname)
const root = path.join(dir, '..')
const distIndex = path.join(root, 'dist-single', 'index.html')
const outHtml = path.join(root, 'eurl.html')
const fontsDir = path.join(root, 'public', 'fonts')

let html = readFileSync(distIndex, 'utf8')
for (const name of ['GeistSans', 'GeistMono']) {
  const file = path.join(fontsDir, `${name}.woff2`)
  const b64 = readFileSync(file).toString('base64')
  const dataUri = `data:font/woff2;base64,${b64}`
  html = html.split(`./fonts/${name}.woff2`).join(dataUri)
}
copyFileSync(distIndex, outHtml)
writeFileSync(outHtml, html)
console.log('single-file build written to', outHtml)
