import { useState } from 'react'
import type { Finding } from '../types'

export default function WaiverFlow({ finding }: { finding: Finding }) {
  const [reason, setReason] = useState('')
  const [author, setAuthor] = useState('')
  const [expiry, setExpiry] = useState('')
  const [copied, setCopied] = useState(false)

  const waiverId = `waiver-${finding.id.slice(0, 8)}-${Date.now().toString(36)}`

  const yaml = `# .pixelbreak-waivers.yml
version: 1
waivers:
  - id: ${waiverId}
    ruleId: ${finding.ruleId}
    route: ${finding.route}
    viewportWidth: ${finding.viewport.width}
    reason: "${reason || 'Reason required'}"
    author: "${author || 'your-username'}"
    createdAt: "${new Date().toISOString()}"${expiry ? `\n    expiresAt: "${expiry}"` : ''}`

  function copy() {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  const isValid = reason.trim().length > 0 && author.trim().length > 0

  return (
    <div className="card" style={{ borderColor: 'var(--moderate)33' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🛡</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>Add a Moderate Waiver</span>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
        Waivers only apply to <strong>moderate</strong> findings. High and critical findings must be fixed.
        Fill in the fields below and copy the YAML snippet into your <code>.pixelbreak-waivers.yml</code> file.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <label>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Reason <span style={{ color: 'var(--block)' }}>*</span></div>
          <input
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Why is this waived? e.g. Known third-party widget issue, tracked in #1234"
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Author <span style={{ color: 'var(--block)' }}>*</span></div>
          <input
            value={author}
            onChange={e => setAuthor(e.target.value)}
            placeholder="your-github-username"
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Expiry date (optional)</div>
          <input
            type="date"
            value={expiry}
            onChange={e => setExpiry(e.target.value)}
          />
        </label>
      </div>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 6 }}>
          Generated YAML
        </div>
        <pre className="diff-block">{yaml}</pre>
      </div>

      <button
        className={isValid ? 'btn-primary' : 'btn-ghost'}
        disabled={!isValid}
        onClick={copy}
        style={{ opacity: isValid ? 1 : 0.5 }}
      >
        {copied ? '✓ Copied!' : '⧉ Copy waiver YAML'}
      </button>
      <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 10 }}>
        Paste into <code>.pixelbreak-waivers.yml</code> and run <code style={{ color: 'var(--accent)' }}>pixelbreak check</code> again.
      </span>
    </div>
  )
}
