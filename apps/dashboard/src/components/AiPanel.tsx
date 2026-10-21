import type { AiExplanation } from '../types'

export default function AiPanel({ explanation }: { explanation: AiExplanation }) {
  return (
    <div className="card" style={{ borderColor: 'var(--accent)33' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🤖</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Local AI Analysis</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: 'var(--text-muted)',
          background: 'var(--surface2)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          padding: '2px 6px',
        }}>
          HYPOTHESIS — NOT VERIFIED
        </span>
      </div>

      <Section label="Summary">
        <p style={{ color: 'var(--text)' }}>{explanation.summary}</p>
      </Section>

      <Section label="Likely Cause">
        <p style={{ color: 'var(--text)' }}>{explanation.likelyCause}</p>
      </Section>

      {explanation.supportingEvidence.length > 0 && (
        <Section label="Supporting Evidence">
          <ul style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {explanation.supportingEvidence.map((ev, i) => (
              <li key={i} style={{ color: 'var(--text)', fontSize: 13 }}>{ev}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Limitations">
        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>{explanation.limitations}</p>
      </Section>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  )
}
