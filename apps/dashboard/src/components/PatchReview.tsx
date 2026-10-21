import { useState } from 'react'
import type { PatchProposal } from '../types'

export default function PatchReview({ patch }: { patch: PatchProposal }) {
  const [copied, setCopied] = useState(false)

  function copyDiff() {
    navigator.clipboard.writeText(patch.diff).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="card" style={{ borderColor: 'var(--moderate)33' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Patch Proposal</span>
        <span style={{
          marginLeft: 'auto',
          fontSize: 10,
          color: 'var(--moderate)',
          background: '#78350f22',
          border: '1px solid #78350f55',
          borderRadius: 4,
          padding: '2px 6px',
          fontWeight: 700,
        }}>
          PREVIEW — REQUIRES EXPLICIT APPROVAL
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <InfoRow label="Selector" value={patch.cssSelector} mono />
        <InfoRow label="Property" value={patch.property} mono />
        <InfoRow label="Current value" value={patch.currentValue || '(not set)'} mono />
        <InfoRow label="Proposed value" value={patch.proposedValue} mono />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>
          Diff
        </div>
        <DiffBlock diff={patch.diff} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
          Why this patch
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{patch.explanation}</p>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
          Expected effect
        </div>
        <p style={{ fontSize: 13, color: 'var(--text)' }}>{patch.expectedEffect}</p>
      </div>

      {patch.validationSteps.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>
            Validation steps
          </div>
          <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {patch.validationSteps.map((step, i) => (
              <li key={i} style={{ fontSize: 13, color: 'var(--text)' }}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn-ghost" onClick={copyDiff}>
          {copied ? '✓ Copied!' : '⧉ Copy diff'}
        </button>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
          Apply this diff to your source file manually, then run <code style={{ margin: '0 4px', color: 'var(--accent)' }}>pixelbreak check</code> to verify.
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ background: 'var(--surface2)', borderRadius: 6, padding: '8px 10px' }}>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: mono ? 'monospace' : 'inherit', fontSize: 13 }}>{value}</div>
    </div>
  )
}

function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="diff-block">
      {diff.split('\n').map((line, i) => {
        let cls = ''
        if (line.startsWith('+')) cls = 'diff-add'
        else if (line.startsWith('-')) cls = 'diff-del'
        else if (line.startsWith('@')) cls = 'diff-hunk'
        return (
          <span key={i} className={cls}>{line}{'\n'}</span>
        )
      })}
    </pre>
  )
}
