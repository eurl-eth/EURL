import { useEffect, useRef, type CSSProperties } from 'react'

type ShapeKind = 'cube' | 'tri' | 'square' | 'ring' | 'cross' | 'dots'

interface ShapeSpec {
  kind: ShapeKind
  pos: { top?: string; left?: string; right?: string; bottom?: string }
  size: number
  depth: number
  dur: number
  delay: number
  opacity?: number
}

const SHAPES: ShapeSpec[] = [
  { kind: 'cube', pos: { top: '16%', left: '5%' }, size: 88, depth: 1.3, dur: 11, delay: 0 },
  { kind: 'square', pos: { top: '70%', left: '9%' }, size: 54, depth: 0.8, dur: 13, delay: -3 },
  { kind: 'tri', pos: { top: '18%', right: '7%' }, size: 76, depth: 1.7, dur: 10, delay: -5 },
  { kind: 'cube', pos: { top: '62%', right: '10%' }, size: 100, depth: 1.05, dur: 14, delay: -2 },
  { kind: 'ring', pos: { top: '40%', left: '15%' }, size: 30, depth: 2.3, dur: 9, delay: -6 },
  { kind: 'square', pos: { top: '9%', right: '27%' }, size: 34, depth: 2.1, dur: 12, delay: -4 },
  { kind: 'cube', pos: { top: '82%', left: '28%' }, size: 42, depth: 1.8, dur: 10.5, delay: -7 },
  { kind: 'tri', pos: { top: '78%', right: '28%' }, size: 34, depth: 2.5, dur: 9.5, delay: -1 },
  { kind: 'cross', pos: { top: '32%', right: '17%' }, size: 20, depth: 2.8, dur: 8.5, delay: -8 },
  { kind: 'dots', pos: { top: '54%', left: '3%' }, size: 56, depth: 0.6, dur: 15, delay: -9 },
]

function ShapeSvg({ kind, size }: { kind: ShapeKind; size: number }) {
  const stroke = { stroke: 'currentColor', fill: 'none' } as const
  switch (kind) {
    case 'cube':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 4 93 27v46L50 96 7 73V27z"
            {...stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="var(--hb-fill)"
          />
          <path
            d="M7 27l43 23 43-23M50 50v46"
            {...stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'tri':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <path
            d="M50 8 94 88H6z"
            {...stroke}
            strokeWidth="2.5"
            strokeLinejoin="round"
            fill="var(--hb-fill)"
          />
        </svg>
      )
    case 'square':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <rect x="12" y="12" width="76" height="76" rx="10" {...stroke} strokeWidth="2.5" />
        </svg>
      )
    case 'ring':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="42" {...stroke} strokeWidth="2.5" />
        </svg>
      )
    case 'cross':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          <path d="M50 8v84M8 50h84" {...stroke} strokeWidth="3" strokeLinecap="round" />
        </svg>
      )
    case 'dots':
      return (
        <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
          {[20, 50, 80].flatMap((y) =>
            [20, 50, 80].map((x) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill="currentColor" />
            )),
          )}
        </svg>
      )
  }
}

export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let raf = 0
    let px = 0
    let py = 0

    const update = () => {
      raf = 0
      const scrollShift = Math.min(window.scrollY, 900) * 0.1
      el.style.setProperty('--mx', `${(px * 26).toFixed(1)}px`)
      el.style.setProperty('--my', `${(py * 18 - scrollShift).toFixed(1)}px`)
    }

    const onMove = (e: PointerEvent) => {
      px = (e.clientX / window.innerWidth - 0.5) * 2
      py = (e.clientY / window.innerHeight - 0.5) * 2
      if (!raf) raf = requestAnimationFrame(update)
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('scroll', onScroll, { passive: true })
    update()

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div className="hb-layer" ref={ref} aria-hidden="true">
      {SHAPES.map((s, i) => (
        <div
          key={i}
          className="hb-shape"
          style={
            {
              ...s.pos,
              width: s.size,
              height: s.size,
              opacity: s.opacity ?? 1,
              '--depth': s.depth,
            } as CSSProperties
          }
        >
          <div
            className="hb-float"
            style={{ animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` }}
          >
            <ShapeSvg kind={s.kind} size={s.size} />
          </div>
        </div>
      ))}
    </div>
  )
}
