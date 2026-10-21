import type { Finding, FindingEvaluation, AiExplanation } from '../types'
import AiPanel from './AiPanel'
import PatchReview from './PatchReview'
import WaiverFlow from './WaiverFlow'

interface Props {
  finding: Finding
  evaluation?: FindingEvaluation
  aiExplanation?: AiExplanation
}

export default function FindingDetail({ finding, evaluation, aiExplanation }: Props) {
  const isBlocked = evaluation?.action === 'block' && !evaluation?.waived

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span className={`badge badge-${finding.severity}`}>{finding.severity}</span>
          <code style={{ color: 'var(--accent)' }}>{finding.ruleId}</code>
          <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 12 }}>
            {finding.route} @ {finding.viewport.width}px
          </span>
        </div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>{finding.summary}</div>
        {finding.selector && (
          <code style={{ color: 'var(--text-muted)' }}>Selector: {finding.selector}</code>
        )}
        {evaluation?.waived && (
          <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--surface2)', borderRadius: 6, color: 'var(--moderate)', fontSize: 12 }}>
            🛡 Waived — waiver ID: {evaluation.waiverId ?? 'unknown'}
          </div>
        )}
      </div>

      {/* Evidence */}
      <EvidencePanel finding={finding} />

      {/* Screenshots */}
      <ScreenshotPanel finding={finding} />

      {/* AI Explanation */}
      {aiExplanation && <AiPanel explanation={aiExplanation} />}

      {/* Patch Review */}
      {aiExplanation?.patch && <PatchReview patch={aiExplanation.patch} />}

      {/* Waiver Flow — only for moderate, blocked */}
      {isBlocked && finding.severity === 'moderate' && (
        <WaiverFlow finding={finding} />
      )}
    </div>
  )
}

function EvidencePanel({ finding }: { finding: Finding }) {
  const ev = finding.evidence
  const geo = ev.measuredGeometry
  const styles = ev.computedStyles

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Evidence
      </div>
      <div style={{ color: 'var(--text)', marginBottom: 10 }}>{ev.description}</div>

      {geo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
          {[
            { label: 'Width', value: geo.width },
            { label: 'scrollWidth', value: geo.scrollWidth },
            { label: 'clientWidth', value: geo.clientWidth },
            { label: 'x / y', value: `${geo.x}, ${geo.y}` },
          ].filter(d => d.value !== undefined).map(d => (
            <div key={d.label} style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{d.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{d.label}</div>
            </div>
          ))}
        </div>
      )}

      {ev.diffPercentage !== undefined && (
        <div style={{ marginBottom: 10 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Visual diff: </span>
          <strong style={{ color: ev.diffPercentage > 2 ? 'var(--high)' : 'var(--moderate)' }}>
            {ev.diffPercentage.toFixed(3)}%
          </strong>
          {ev.diffPixels !== undefined && <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> ({ev.diffPixels} px)</span>}
        </div>
      )}

      {styles && Object.keys(styles).length > 0 && (
        <>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Computed CSS:</div>
          <pre className="diff-block" style={{ fontSize: 11 }}>
            {Object.entries(styles)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => `${k}: ${v};`)
              .join('\n')}
          </pre>
        </>
      )}
    </div>
  )
}

function ScreenshotPanel({ finding }: { finding: Finding }) {
  const has = (p?: string) => p && p.trim() !== ''

  if (!has(finding.currentImage) && !has(finding.baselineImage) && !has(finding.diffImage)) {
    return null
  }

  return (
    <div className="card">
      <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Screenshots
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
        {has(finding.baselineImage) && (
          <Screenshot label="Baseline" src={`/artifacts/${encodeURIComponent(finding.baselineImage!)}`} />
        )}
        {has(finding.currentImage) && (
          <Screenshot label="Current" src={`/artifacts/${encodeURIComponent(finding.currentImage!)}`} />
        )}
        {has(finding.diffImage) && (
          <Screenshot label="Diff" src={`/artifacts/${encodeURIComponent(finding.diffImage!)}`} highlight />
        )}
      </div>
    </div>
  )
}

function Screenshot({ label, src, highlight }: { label: string; src: string; highlight?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: highlight ? 'var(--high)' : 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
        {label}
      </div>
      <img
        src={src}
        alt={label}
        style={{
          width: '100%',
          borderRadius: 6,
          border: `1px solid ${highlight ? 'var(--high)' : 'var(--border)'}`,
          display: 'block',
        }}
        onError={e => {
          (e.target as HTMLImageElement).style.display = 'none'
        }}
      />
    </div>
  )
}
