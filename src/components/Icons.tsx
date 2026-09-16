interface IconProps {
  size?: number
}

export function CubeMark({ size = 18 }: IconProps) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden="true">
        <path
          d="M50 24 74 37v26L50 76 26 63V37z"
          fill="var(--bg)"
          stroke="none"
        />
        <path
          d="M26 37l24 13 24-13M50 50v26"
          stroke="var(--fg)"
          strokeWidth="5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

export function IconX({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5l9 9m0-9l-9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconCheck({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2.5 8.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconAlert({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.8L15 14H1z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M8 6v3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8" cy="11.7" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function IconShield({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 1.5l5.5 2v4c0 3.4-2.3 5.8-5.5 7-3.2-1.2-5.5-3.6-5.5-7v-4z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path
        d="M6 6.2l4 3.6m0-3.6l-4 3.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconWallet({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4.5" width="16" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 8h16" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="14.2" cy="12.2" r="1" fill="currentColor" />
    </svg>
  )
}

export function IconWc({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5c2.5-2.3 6.5-2.3 9 0M7.6 9.7c1.4-1.2 3.4-1.2 4.8 0M9.6 11.9a.7.7 0 01.8 0"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14" r="0.9" fill="currentColor" />
    </svg>
  )
}

export function IconSun({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 1v2M8 13v2M1 8h2M13 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M13.1 2.9l-1.4 1.4M4.3 11.7l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconMoon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13.5 9.2A5.5 5.5 0 016.8 2.5a5.5 5.5 0 106.7 6.7z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconAuto({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10.5 2.5a6 6 0 11-5 5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path d="M10 1L11 3.5 13.5 4.5 11 5.5 10 8 9 5.5 6.5 4.5 9 3.5z" fill="currentColor" />
    </svg>
  )
}
