import { useState, useEffect } from 'react'
import type { EnrichedReport, Finding, SeverityLevel } from './types'
import ScanSummary from './components/ScanSummary'
import FindingsList from './components/FindingsList'
import FindingDetail from './components/FindingDetail'

export default function App() {
  const [report, setReport] = useState<EnrichedReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Finding | null>(null)
  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')

  useEffect(() => {
    fetch('/api/reports/latest')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}: ${r.statusText}`)
        return r.json() as Promise<EnrichedReport>
      })
      .then(data => {
        setReport(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      })
  }, [])

  if (loading) return <LoadingScreen />
  if (error || !report) return <ErrorScreen error={error ?? 'No report found. Run pixelbreak check first.'} />

  const allFindings = report.policyResult.findings
  const filtered = allFindings.filter(fe => {
    if (severityFilter !== 'all' && fe.finding.severity !== severityFilter) return false
    if (categoryFilter !== 'all' && fe.finding.category !== categoryFilter) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Header report={report} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel — sticky, scrolls independently */}
        <div style={{ width: 380, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <ScanSummary report={report} />
          <Filters
            severityFilter={severityFilter}
            categoryFilter={categoryFilter}
            onSeverity={setSeverityFilter}
            onCategory={setCategoryFilter}
          />
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            <FindingsList
              findings={filtered}
              selected={selected}
              onSelect={setSelected}
            />
          </div>
        </div>
        {/* Right detail panel — scrolls independently */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, minHeight: 0 }}>
          {selected
            ? <FindingDetail
                finding={selected}
                evaluation={report.policyResult.findings.find(fe => fe.finding.id === selected.id)}
                aiExplanation={report.aiExplanations?.[selected.id]}
              />
            : <EmptyDetail count={filtered.length} />
          }
        </div>
      </div>
    </div>
  )
}

function Header({ report }: { report: EnrichedReport }) {
  const decision = report.policyResult.decision
  return (
    <header style={{
      padding: '12px 20px',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      background: 'var(--surface)',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <img
        src="/logo-header.png"
        alt="PixelBreak"
        style={{ height: 60, objectFit: 'contain' }}
      />
      <span className={`badge badge-${decision}`}>
        {decision === 'pass' ? '✓ PASS' : '✗ BLOCKED'}
      </span>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        {report.config?.project?.name ?? 'unknown project'}
      </span>
      <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
        {new Date(report.timestamp).toLocaleString()} · {(report.durationMs / 1000).toFixed(1)}s
      </span>
      <button
        className="btn-ghost"
        style={{ fontSize: 12 }}
        onClick={() => window.location.reload()}
      >
        ↻ Refresh
      </button>
    </header>
  )
}

function Filters({
  severityFilter, categoryFilter, onSeverity, onCategory
}: {
  severityFilter: SeverityLevel | 'all'
  categoryFilter: string
  onSeverity: (v: SeverityLevel | 'all') => void
  onCategory: (v: string) => void
}) {
  return (
    <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8 }}>
      <select value={severityFilter} onChange={e => onSeverity(e.target.value as SeverityLevel | 'all')} style={{ flex: 1 }}>
        <option value="all">All severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="moderate">Moderate</option>
        <option value="low">Low</option>
        <option value="informational">Informational</option>
      </select>
      <select value={categoryFilter} onChange={e => onCategory(e.target.value)} style={{ flex: 1 }}>
        <option value="all">All categories</option>
        <option value="layout">Layout</option>
        <option value="visual-regression">Visual</option>
        <option value="scanner">Scanner</option>
      </select>
    </div>
  )
}

function EmptyDetail({ count }: { count: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--text-muted)', gap: 8 }}>
      <span style={{ fontSize: 32 }}>◎</span>
      <span>{count === 0 ? 'No findings match the current filter.' : 'Select a finding to view details.'}</span>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>
      Loading latest scan report…
    </div>
  )
}

function ErrorScreen({ error }: { error: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 12 }}>
      <span style={{ fontSize: 24, color: 'var(--block)' }}>✗ No Report</span>
      <span style={{ color: 'var(--text-muted)', maxWidth: 480, textAlign: 'center' }}>{error}</span>
      <code style={{ color: 'var(--accent)' }}>pixelbreak check</code>
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Run the command above to generate a report, then refresh.</span>
    </div>
  )
}
