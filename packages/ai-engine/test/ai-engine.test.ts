import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { LlamaCppAdapter, AiUnavailableError, AiResponseError } from '../src/adapter.js'
import { parseAndValidateAiResponse } from '../src/validator.js'
import { buildExplanationPrompt } from '../src/prompts.js'
import type { Finding } from '@pixelbreak/contracts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f-001',
    scanId: 'scan-001',
    toolVersion: '0.1.0',
    timestamp: new Date().toISOString(),
    ruleId: 'horizontal-overflow',
    severity: 'high',
    category: 'layout',
    route: '/',
    viewport: { width: 1024, height: 768 },
    selector: '#metrics-card',
    summary: 'Element #metrics-card overflows the 1024px viewport by 56px',
    evidence: {
      description: 'scrollWidth (1080) exceeds viewport width (1024)',
      measuredGeometry: { x: 0, y: 200, width: 1080, height: 120, scrollWidth: 1080, clientWidth: 1024 },
      viewportGeometry: { width: 1024, height: 768 },
      computedStyles: { overflow: 'visible', display: 'flex', width: '100%' },
    },
    status: 'open',
    ...overrides,
  }
}

const VALID_AI_RESPONSE = JSON.stringify({
  summary: 'The #metrics-card element exceeds the 1024px viewport due to a fixed-width child.',
  likelyCause: 'A child element inside #metrics-card likely has a fixed pixel width or min-width that prevents shrinking.',
  supportingEvidence: [
    'scrollWidth (1080) exceeds clientWidth (1024) by 56px',
    'display is flex — flex children may not shrink if flex-shrink: 0 is set',
  ],
  patch: {
    cssSelector: '#metrics-card',
    property: 'overflow-x',
    currentValue: 'visible',
    proposedValue: 'hidden',
    diff: '--- a/src/style.css\n+++ b/src/style.css\n@@ -1,3 +1,3 @@\n #metrics-card {\n-  overflow-x: visible;\n+  overflow-x: hidden;\n }',
    explanation: 'Clipping the overflow prevents the card from exceeding the viewport width.',
    expectedEffect: 'The card will no longer cause horizontal scrollbars at 1024px.',
    validationSteps: [
      'Apply the patch and reload at 1024px',
      'Confirm no horizontal scrollbar appears',
      'Run pixelbreak check to verify the finding is resolved',
    ],
  },
  limitations: 'Cannot determine which child element is responsible without access to the full DOM tree.',
})

// ---------------------------------------------------------------------------
// Validator tests
// ---------------------------------------------------------------------------

describe('parseAndValidateAiResponse', () => {
  it('accepts a well-formed AI response', () => {
    const result = parseAndValidateAiResponse(VALID_AI_RESPONSE)
    expect(result.summary).toContain('#metrics-card')
    expect(result.isHypothesis).toBeUndefined() // added by adapter, not in schema
    expect(result.patch).not.toBeNull()
    expect(result.patch?.cssSelector).toBe('#metrics-card')
  })

  it('accepts a response with null patch', () => {
    const withNullPatch = JSON.stringify({
      summary: 'Short summary.',
      likelyCause: 'Unknown cause.',
      supportingEvidence: ['overflow detected'],
      patch: null,
      limitations: 'Insufficient context.',
    })
    const result = parseAndValidateAiResponse(withNullPatch)
    expect(result.patch).toBeNull()
  })

  it('rejects non-JSON input', () => {
    expect(() => parseAndValidateAiResponse('This is not JSON')).toThrow(
      /not valid JSON/
    )
  })

  it('rejects a response missing required fields', () => {
    const incomplete = JSON.stringify({ summary: 'Only summary.' })
    expect(() => parseAndValidateAiResponse(incomplete)).toThrow(
      /schema validation/
    )
  })

  it('rejects an empty summary', () => {
    const bad = JSON.stringify({
      summary: '',
      likelyCause: 'some cause',
      supportingEvidence: ['ev'],
      patch: null,
      limitations: 'none',
    })
    expect(() => parseAndValidateAiResponse(bad)).toThrow(/schema validation/)
  })
})

// ---------------------------------------------------------------------------
// Prompt builder tests
// ---------------------------------------------------------------------------

describe('buildExplanationPrompt', () => {
  it('includes the finding rule, severity, selector and geometry', () => {
    const prompt = buildExplanationPrompt(makeFinding())
    expect(prompt).toContain('horizontal-overflow')
    expect(prompt).toContain('high')
    expect(prompt).toContain('#metrics-card')
    expect(prompt).toContain('1024')
    expect(prompt).toContain('scrollWidth=1080')
  })

  it('appends source context when provided', () => {
    const prompt = buildExplanationPrompt(makeFinding(), '.card { width: 1200px; }')
    expect(prompt).toContain('.card { width: 1200px; }')
  })

  it('truncates source context at 800 characters', () => {
    const longContext = 'x'.repeat(1000)
    const prompt = buildExplanationPrompt(makeFinding(), longContext)
    expect(prompt).toContain('x'.repeat(800))
    expect(prompt).not.toContain('x'.repeat(801))
  })
})

// ---------------------------------------------------------------------------
// Adapter tests — mock fetch
// ---------------------------------------------------------------------------

describe('LlamaCppAdapter', () => {
  const config = { provider: 'local' as const, endpoint: 'http://localhost:8080', requiredForExplanations: true, requiredForFixSuggestions: true }

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns available=true when endpoint is reachable', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ id: 'qwen2.5-coder' }] }), { status: 200 })
    )
    const adapter = new LlamaCppAdapter(config)
    const status = await adapter.checkStatus()
    expect(status.available).toBe(true)
    expect(status.model).toBe('qwen2.5-coder')
  })

  it('returns available=false when endpoint is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const adapter = new LlamaCppAdapter(config)
    const status = await adapter.checkStatus()
    expect(status.available).toBe(false)
    expect(status.error).toContain('ECONNREFUSED')
  })

  it('parses a valid completion response into AiExplanation', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'cmpl-1',
          object: 'chat.completion',
          model: 'local',
          choices: [{ index: 0, message: { role: 'assistant', content: VALID_AI_RESPONSE }, finish_reason: 'stop' }],
        }),
        { status: 200 }
      )
    )
    const adapter = new LlamaCppAdapter(config)
    const explanation = await adapter.explainFinding({ finding: makeFinding() })

    expect(explanation.findingId).toBe('f-001')
    expect(explanation.severity).toBe('high')      // unchanged — never altered by AI
    expect(explanation.isHypothesis).toBe(true)    // always true
    expect(explanation.patch).not.toBeNull()
    expect(explanation.summary).toContain('#metrics-card')
  })

  it('throws AiUnavailableError when the endpoint is down', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('fetch failed'))
    const adapter = new LlamaCppAdapter(config)
    await expect(adapter.explainFinding({ finding: makeFinding() })).rejects.toThrow(
      AiUnavailableError
    )
  })

  it('throws AiResponseError when the model returns malformed JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'cmpl-2',
          object: 'chat.completion',
          model: 'local',
          choices: [{ index: 0, message: { role: 'assistant', content: 'not json at all' }, finish_reason: 'stop' }],
        }),
        { status: 200 }
      )
    )
    const adapter = new LlamaCppAdapter(config)
    await expect(adapter.explainFinding({ finding: makeFinding() })).rejects.toThrow(
      AiResponseError
    )
  })

  it('AI severity field reflects the finding severity — never altered', async () => {
    // Even if the raw model response contained a different severity somehow,
    // the adapter always returns the finding's original severity.
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          id: 'cmpl-3',
          object: 'chat.completion',
          model: 'local',
          choices: [{ index: 0, message: { role: 'assistant', content: VALID_AI_RESPONSE }, finish_reason: 'stop' }],
        }),
        { status: 200 }
      )
    )
    const criticalFinding = makeFinding({ severity: 'critical' })
    const adapter = new LlamaCppAdapter(config)
    const explanation = await adapter.explainFinding({ finding: criticalFinding })
    expect(explanation.severity).toBe('critical')
  })
})
