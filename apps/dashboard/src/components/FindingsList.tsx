import type { Finding, FindingEvaluation } from '../types'

interface Props {
  findings: FindingEvaluation[]
  selected: Finding | null
  onSelect: (f: Finding) => void
}

export default function FindingsList({ findings, selected, onSelect }: Props) {
  if (findings.length === 0) {
    return (
      <div style={{ padding: 20, color: 'var(--text-muted)', textAlign: 'center' }}>
        No findings match the current filter.
      </div>
    )
  }

  return (
    <ul style={{ listStyle: 'none', padding: '8px 0' }}>
      {findings.map(fe => (
        <FindingRow
          key={fe.finding.id}
          evaluation={fe}
          isSelected={selected?.id === fe.finding.id}
          onSelect={() => onSelect(fe.finding)}
        />
      ))}
    </ul>
  )
}

function FindingRow({ evaluation, isSelected, onSelect }: {
  evaluation: FindingEvaluation
  isSelected: boolean
  onSelect: () => void
}) {
  const { finding, action, waived } = evaluation
  const statusIcon = waived ? '🛡' : action === 'block' ? '✗' : '✓'
  const statusColor = waived
    ? 'var(--moderate)'
    : action === 'block'
    ? 'var(--block)'
    : 'var(--pass)'

  return (
    <li
      onClick={onSelect}
      style={{
        padding: '10px 14px',
        cursor: 'pointer',
        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
        background: isSelected ? 'var(--surface2)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ color: statusColor, fontSize: 11, fontWeight: 700 }}>{statusIcon}</span>
        <span className={`badge badge-${finding.severity}`}>{finding.severity}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {finding.viewport.width}px
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
        {finding.ruleId}
      </div>
      <div style={{ fontSize: 13, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {finding.summary}
      </div>
    </li>
  )
}
