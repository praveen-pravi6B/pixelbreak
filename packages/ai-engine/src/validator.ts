import { z } from 'zod'

/** Zod schema for the patch proposal section of the AI response. */
const PatchProposalSchema = z.object({
  cssSelector: z.string().min(1),
  property: z.string().min(1),
  currentValue: z.string(),
  proposedValue: z.string().min(1),
  diff: z.string().min(1),
  explanation: z.string().min(1),
  expectedEffect: z.string().min(1),
  validationSteps: z.array(z.string()).min(1),
})

/** Zod schema for the full AI explanation response. */
export const AiExplanationResponseSchema = z.object({
  summary: z.string().min(1).max(500),
  likelyCause: z.string().min(1).max(1000),
  supportingEvidence: z.array(z.string()).min(1).max(10),
  patch: PatchProposalSchema.nullable(),
  limitations: z.string().min(1).max(500),
})

export type AiExplanationResponse = z.infer<typeof AiExplanationResponseSchema>

/**
 * Parse and validate the raw string content returned by the LLM.
 * Throws a descriptive error if the response is malformed or fails schema validation.
 * Never throws a generic error that could hide the validation failure.
 */
export function parseAndValidateAiResponse(rawContent: string): AiExplanationResponse {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawContent.trim())
  } catch {
    throw new Error(
      `AI response is not valid JSON. The model returned malformed output.\n` +
      `Raw content (first 200 chars): ${rawContent.slice(0, 200)}`
    )
  }

  const result = AiExplanationResponseSchema.safeParse(parsed)
  if (!result.success) {
    const issues = result.error.issues
      .map(i => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `AI response failed schema validation:\n${issues}\n` +
      `Raw content (first 200 chars): ${rawContent.slice(0, 200)}`
    )
  }

  return result.data
}
