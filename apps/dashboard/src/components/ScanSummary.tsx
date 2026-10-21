import type { EnrichedReport } from '../types'

export default function ScanSummary({ report }: { report: EnrichedReport }) {
  const pr = report.policyResult
  const sc = pr.severityCounts

  return (
    <div style={{ padding: 16, borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12 }}>
        <StatBox label="Blocked" value={pr.blockedCount} color="var(--block)" />
        <StatBox label="Waived" value={pr.waivedCount} color="var(--moderate)" />
        <StatBox label="Allowed" value={pr.allowedCount} color="var(--pass)" />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <SeverityPip label="C" count={sc.critical ?? 0} cls="badge-critical" />
        <SeverityPip label="H" count={sc.high ?? 0} cls="badge-high" />
        <SeverityPip label="M" count={sc.moderate ?? 0} cls="badge-moderate" />
        <SeverityPip label="L" count={sc.low ?? 0} cls="badge-low" />
        <SeverityPip label="I" count={sc.informational ?? 0} cls="badge-informational" />
      </div>
      <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12 }}>
        {report.routesScanned.length} route(s) · {report.viewportsScanned.join(', ')}px
      </div>
    </div>
  )
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      background: 'var(--surface2)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: '10px 12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function SeverityPip({ label, count, cls }: { label: string; count: number; cls: string }) {
  if (count === 0) return null
  return (
    <span className={`badge ${cls}`}>{label}: {count}</span>
  )
}
