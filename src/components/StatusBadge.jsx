import { getStage } from '../data/mockData'

export default function StatusBadge({ status, size = 'md' }) {
  const stage = getStage(status)
  const pad = size === 'sm' ? '2px 8px' : '3px 10px'
  const font = size === 'sm' ? '11px' : '12px'

  return (
    <span
      style={{
        color: stage.color,
        background: stage.bg,
        border: `1px solid ${stage.border}`,
        padding: pad,
        fontSize: font,
        fontWeight: 600,
        borderRadius: 20,
        letterSpacing: '0.02em',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: stage.color,
          display: 'inline-block',
        }}
      />
      {status}
    </span>
  )
}
