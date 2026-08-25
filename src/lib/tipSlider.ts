export const TIP_MIN_USD = 0.01
export const TIP_MAX_USD = 10
export const TIP_DEFAULT_USD = 0.1
export const TIP_BREAKS = [0.01, 0.1, 1, 10] as const

export function tipUsdFromSlider(pos: number): number {
  if (pos >= 100) return TIP_MAX_USD
  if (pos <= 0) return TIP_MIN_USD
  const seg = Math.min(2, Math.floor(pos / 33.34))
  const frac = Math.min(1, (pos - seg * 33.34) / 33.34)
  const lo = TIP_BREAKS[seg]
  const hi = TIP_BREAKS[seg + 1]
  return +(lo * Math.pow(hi / lo, frac)).toPrecision(4)
}

export function tipSliderFromUsd(usd: number): number {
  if (usd >= TIP_MAX_USD) return 100
  if (usd <= TIP_MIN_USD) return 0
  for (let seg = 0; seg < 3; seg++) {
    const lo = TIP_BREAKS[seg]
    const hi = TIP_BREAKS[seg + 1]
    if (usd >= lo && usd <= hi) {
      const frac = Math.log(usd / lo) / Math.log(hi / lo)
      return seg * 33.34 + frac * 33.34
    }
  }
  return 0
}
