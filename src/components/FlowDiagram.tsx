interface FlowStep {
  title: string
  sub: string
}

interface FlowDiagramProps {
  steps: FlowStep[]
}

const STEP_W = 156
const STEP_H = 64
const ARROW = 26
const GAP = 8

export function FlowDiagram({ steps }: FlowDiagramProps) {
  const n = steps.length
  const width = n * STEP_W + (n - 1) * (ARROW + GAP * 2)
  const height = 120

  return (
    <div className="flow-wrap">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-hidden="true"
        style={{ display: 'block', maxWidth: width }}
      >
        {steps.map((step, i) => {
          const x = i * (STEP_W + ARROW + GAP * 2)
          const y = (height - STEP_H) / 2
          return (
            <g key={i}>
              {i > 0 && (
                <g className="flow-arrow">
                  <line
                    x1={x - ARROW - GAP * 2}
                    y1={height / 2}
                    x2={x - GAP * 2}
                    y2={height / 2}
                  />
                  <path
                    d={`M${x - GAP * 2 - 6} ${height / 2 - 5} l6 5 -6 5`}
                    fill="none"
                  />
                </g>
              )}
              <rect x={x} y={y} width={STEP_W} height={STEP_H} rx={10} className="flow-node" />
              <text x={x + STEP_W / 2} y={y + 26} textAnchor="middle" className="flow-title">
                {step.title}
              </text>
              <text x={x + STEP_W / 2} y={y + 46} textAnchor="middle" className="flow-sub">
                {step.sub}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
