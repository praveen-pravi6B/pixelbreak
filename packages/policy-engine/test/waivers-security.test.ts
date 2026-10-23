import { describe, it, expect } from 'vitest'
import { loadWaiversFile } from '../src/waivers.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

function writeTmp(content: string): string {
  const file = path.join(os.tmpdir(), `pixelbreak-waiver-${Date.now()}.yml`)
  fs.writeFileSync(file, content, 'utf-8')
  return file
}

describe('loadWaiversFile — security + edge cases', () => {
  it('returns empty array for non-existent file', () => {
    expect(loadWaiversFile('/tmp/does-not-exist-pixelbreak.yml')).toEqual([])
  })

  it('returns empty array for empty file', () => {
    const f = writeTmp('')
    expect(loadWaiversFile(f)).toEqual([])
    fs.unlinkSync(f)
  })

  it('parses valid array format', () => {
    const f = writeTmp(`
- id: w-001
  ruleId: horizontal-overflow
  reason: "Known third-party issue"
  author: dev
  createdAt: "2026-10-01T00:00:00.000Z"
`)
    const result = loadWaiversFile(f)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('w-001')
    fs.unlinkSync(f)
  })

  it('parses valid object format {version, waivers}', () => {
    const f = writeTmp(`
version: 1
waivers:
  - id: w-002
    ruleId: visual-regression
    reason: "Approved layout change"
    author: dev
    createdAt: "2026-10-01T00:00:00.000Z"
`)
    const result = loadWaiversFile(f)
    expect(result).toHaveLength(1)
    expect(result[0].ruleId).toBe('visual-regression')
    fs.unlinkSync(f)
  })

  it('rejects YAML with unknown/extra keys (strict mode)', () => {
    const f = writeTmp(`
- id: w-bad
  reason: "test"
  author: dev
  createdAt: "2026-10-01T00:00:00.000Z"
  unknownField: "should be rejected"
`)
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    fs.unlinkSync(f)
  })

  it('rejects YAML with missing required reason field', () => {
    const f = writeTmp(`
- id: w-no-reason
  ruleId: horizontal-overflow
  author: dev
  createdAt: "2026-10-01T00:00:00.000Z"
`)
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    fs.unlinkSync(f)
  })

  it('rejects YAML with missing required createdAt field', () => {
    const f = writeTmp(`
- id: w-no-date
  reason: "test"
  author: dev
`)
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    fs.unlinkSync(f)
  })

  it('rejects prototype pollution attempt via __proto__ key', () => {
    // Malicious YAML attempting to pollute Object prototype
    const f = writeTmp(`
- id: w-attack
  reason: "test"
  author: dev
  createdAt: "2026-10-01T00:00:00.000Z"
  __proto__:
    isAdmin: true
`)
    // Should either throw (strict mode rejects unknown keys) or sanitize
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    // Verify prototype was NOT polluted
    expect((Object.prototype as Record<string, unknown>)['isAdmin']).toBeUndefined()
    fs.unlinkSync(f)
  })

  it('rejects invalid severity level', () => {
    const f = writeTmp(`
- id: w-bad-severity
  reason: "test"
  author: dev
  createdAt: "2026-10-01T00:00:00.000Z"
  maxSeverityAllowed: "ultralow"
`)
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    fs.unlinkSync(f)
  })

  it('throws on invalid YAML syntax', () => {
    const f = writeTmp('invalid: yaml: content: [unclosed')
    expect(() => loadWaiversFile(f)).toThrow()
    fs.unlinkSync(f)
  })

  it('throws on completely wrong structure (scalar)', () => {
    const f = writeTmp('just a string')
    expect(() => loadWaiversFile(f)).toThrow(/Invalid waivers file/)
    fs.unlinkSync(f)
  })
})
