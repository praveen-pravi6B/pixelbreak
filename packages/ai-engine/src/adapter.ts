import type { AIConfig } from '@pixelbreak/contracts'
import type {
  AiExplanation,
  AiStatus,
  ExplainFindingInput,
  LlamaCppCompletionResponse,
} from './types.js'
import { buildExplanationPrompt, SYSTEM_PROMPT } from './prompts.js'
import { parseAndValidateAiResponse } from './validator.js'

const DEFAULT_ENDPOINT = 'http://localhost:8080'
const REQUEST_TIMEOUT_MS = 30_000

/** Thrown when the local llama.cpp endpoint is unreachable or returns a non-OK status. */
export class AiUnavailableError extends Error {
  constructor(endpoint: string, cause: string) {
    super(
      `Local AI is unavailable at ${endpoint}: ${cause}\n` +
      `Start llama.cpp with: llama-server --model <model.gguf> --port 8080\n` +
      `Then retry: pixelbreak ai status`
    )
    this.name = 'AiUnavailableError'
  }
}

/** Thrown when the AI response is malformed or fails schema validation. */
export class AiResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiResponseError'
  }
}

/**
 * Adapter for a locally running llama.cpp server using the OpenAI-compatible API.
 * Connects ONLY to the configured local endpoint — no remote services, no fallback.
 */
export class LlamaCppAdapter {
  private readonly endpoint: string
  private readonly model: string

  constructor(config: AIConfig) {
    this.endpoint = (config.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, '')
    this.model = config.model ?? 'local'
  }

  /**
   * Check whether the local llama.cpp server is reachable and responsive.
   * Never throws — returns status with available=false and an error message on failure.
   */
  async checkStatus(): Promise<AiStatus> {
    const start = Date.now()
    const url = `${this.endpoint}/v1/models`

    try {
      const response = await fetchWithTimeout(url, { method: 'GET' }, 5_000)
      const latencyMs = Date.now() - start

      if (!response.ok) {
        return {
          available: false,
          endpoint: this.endpoint,
          latencyMs,
          error: `Server responded with HTTP ${response.status}`,
        }
      }

      let model: string | undefined
      try {
        const body = (await response.json()) as { data?: Array<{ id: string }> }
        model = body?.data?.[0]?.id ?? this.model
      } catch {
        model = this.model
      }

      return { available: true, endpoint: this.endpoint, model, latencyMs }
    } catch (err) {
      return {
        available: false,
        endpoint: this.endpoint,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  /**
   * Request a structured explanation and optional CSS patch proposal from the local LLM.
   *
   * @throws {AiUnavailableError} When the endpoint is unreachable.
   * @throws {AiResponseError} When the response is malformed or fails schema validation.
   */
  async explainFinding(input: ExplainFindingInput): Promise<AiExplanation> {
    const { finding, sourceContext } = input
    const url = `${this.endpoint}/v1/chat/completions`

    const userPrompt = buildExplanationPrompt(finding, sourceContext)

    const requestBody = {
      model: this.model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    }

    let response: Response
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
        REQUEST_TIMEOUT_MS
      )
    } catch (err) {
      throw new AiUnavailableError(
        this.endpoint,
        err instanceof Error ? err.message : String(err)
      )
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new AiUnavailableError(
        this.endpoint,
        `HTTP ${response.status}: ${body.slice(0, 200)}`
      )
    }

    let completion: LlamaCppCompletionResponse
    try {
      completion = (await response.json()) as LlamaCppCompletionResponse
    } catch {
      throw new AiResponseError('Failed to parse llama.cpp JSON response body.')
    }

    const content = completion?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || content.trim() === '') {
      throw new AiResponseError('llama.cpp returned an empty or missing message content.')
    }

    let validated
    try {
      validated = parseAndValidateAiResponse(content)
    } catch (err) {
      throw new AiResponseError(err instanceof Error ? err.message : String(err))
    }

    return {
      findingId: finding.id,
      severity: finding.severity,
      isHypothesis: true,
      summary: validated.summary,
      likelyCause: validated.likelyCause,
      supportingEvidence: validated.supportingEvidence,
      patch: validated.patch
        ? {
            cssSelector: validated.patch.cssSelector,
            property: validated.patch.property,
            currentValue: validated.patch.currentValue,
            proposedValue: validated.patch.proposedValue,
            diff: validated.patch.diff,
            explanation: validated.patch.explanation,
            expectedEffect: validated.patch.expectedEffect,
            validationSteps: validated.patch.validationSteps,
          }
        : null,
      limitations: validated.limitations,
    }
  }
}

/** Native fetch with an AbortController-based timeout. */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
