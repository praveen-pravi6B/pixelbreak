import type { Finding, SeverityLevel } from '@pixelbreak/contracts'

/**
 * A validated, schema-checked explanation produced by the local LLM.
 * All fields are hypotheses — not independently verified facts.
 * AI output CANNOT change finding severity, waive findings, or apply patches.
 */
export interface AiExplanation {
  /** One-to-two sentence plain-language summary of the issue. Labelled as hypothesis. */
  summary: string
  /** The AI's hypothesis about the most likely root cause. */
  likelyCause: string
  /** Specific details from the finding that support the hypothesis. */
  supportingEvidence: string[]
  /** An optional CSS patch proposal. Never auto-applied — requires explicit developer approval. */
  patch: PatchProposal | null
  /** What the model is uncertain about or could not determine from the evidence provided. */
  limitations: string
  /**
   * Always true. Ensures callers label AI output as hypothetical.
   * The AI cannot independently verify its own claims.
   */
  isHypothesis: true
  /** The finding this explanation relates to. */
  findingId: string
  /** Severity as determined by the deterministic policy engine — never altered by AI. */
  severity: SeverityLevel
}

/**
 * A CSS patch proposed by the local LLM.
 * This is a PREVIEW ONLY. The developer must explicitly approve before any file is modified.
 */
export interface PatchProposal {
  /** CSS selector targeting the broken element. */
  cssSelector: string
  /** The CSS property being changed. */
  property: string
  /** The current computed or declared value (may be empty string if unknown). */
  currentValue: string
  /** The proposed replacement value. */
  proposedValue: string
  /** Unified diff format of the proposed change. */
  diff: string
  /** Why this patch is expected to fix the issue. */
  explanation: string
  /** The visual or functional outcome expected after applying the patch. */
  expectedEffect: string
  /** Steps to manually verify the patch works correctly. */
  validationSteps: string[]
}

/** Status of the local llama.cpp endpoint. */
export interface AiStatus {
  available: boolean
  endpoint: string
  /** Model name reported by the server, if available. */
  model?: string
  /** Round-trip latency in milliseconds to the endpoint, if reachable. */
  latencyMs?: number
  /** Error message when unavailable. */
  error?: string
}

/** Raw OpenAI-compatible chat completion response from llama.cpp. */
export interface LlamaCppCompletionResponse {
  id: string
  object: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string
  }>
}

/** Input passed to the adapter for a single finding explanation request. */
export interface ExplainFindingInput {
  finding: Finding
  /** Source snippet or additional CSS context, if available. Limited to avoid token waste. */
  sourceContext?: string
}
