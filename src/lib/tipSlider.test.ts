import { describe, expect, it } from 'vitest'
import { tipSliderFromUsd, tipUsdFromSlider } from './tipSlider'

describe('tip slider mapping', () => {
  it('maps segment boundaries', () => {
    expect(tipUsdFromSlider(0)).toBeCloseTo(0.01)
    expect(tipUsdFromSlider(100)).toBeCloseTo(10)
    expect(tipSliderFromUsd(0.1)).toBeGreaterThan(30)
    expect(tipSliderFromUsd(0.1)).toBeLessThan(40)
  })

  it('round trips within each segment', () => {
    for (const usd of [0.02, 0.05, 0.2, 0.5, 2, 5]) {
      const pos = tipSliderFromUsd(usd)
      const back = tipUsdFromSlider(pos)
      expect(Math.abs(back / usd - 1)).toBeLessThan(0.05)
    }
  })

  it('monotonically increases', () => {
    let prev = 0
    for (let pos = 0; pos <= 100; pos += 5) {
      const v = tipUsdFromSlider(pos)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})
