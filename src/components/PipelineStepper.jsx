import { PIPELINE_STAGES, getStage } from '../data/mockData'
import { Check } from 'lucide-react'

export default function PipelineStepper({ currentStatus }) {
  const currentIndex = getStage(currentStatus).index

  return (
    <div style={{ padding: '8px 0' }}>
      {PIPELINE_STAGES.map((stage, i) => {
        const isDone = i < currentIndex
        const isCurrent = i === currentIndex
        const isUpcoming = i > currentIndex
        const isLast = i === PIPELINE_STAGES.length - 1

        return (
          <div key={stage.status} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Circle + connector line */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                  background: isDone
                    ? stage.color
                    : isCurrent
                    ? stage.bg
                    : 'rgba(30,37,51,0.8)',
                  border: `2px solid ${isDone || isCurrent ? stage.color : '#2e3a50'}`,
                  color: isDone ? '#fff' : isCurrent ? stage.color : '#4a5568',
                  boxShadow: isCurrent ? `0 0 0 4px ${stage.bg}` : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {isDone ? (
                  <Check size={13} strokeWidth={3} />
                ) : (
                  <span>{i + 1}</span>
                )}
              </div>
              {!isLast && (
                <div
                  style={{
                    width: 2,
                    height: 24,
                    background: isDone ? stage.color : '#1e2533',
                    marginTop: 2,
                    borderRadius: 1,
                    transition: 'background 0.2s',
                  }}
                />
              )}
            </div>

            {/* Label */}
            <div style={{ paddingTop: 5, paddingBottom: isLast ? 0 : 22 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: isCurrent ? 600 : 400,
                  color: isDone
                    ? stage.color
                    : isCurrent
                    ? stage.color
                    : '#4a5568',
                }}
              >
                {stage.status}
              </div>
              {isCurrent && (
                <div
                  style={{
                    fontSize: 11,
                    color: '#8b95a8',
                    marginTop: 2,
                  }}
                >
                  Current stage
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
