export { LlamaCppAdapter, AiUnavailableError, AiResponseError } from './adapter.js'
export { parseAndValidateAiResponse, AiExplanationResponseSchema } from './validator.js'
export { buildExplanationPrompt, SYSTEM_PROMPT } from './prompts.js'
export type {
  AiExplanation,
  PatchProposal,
  AiStatus,
  ExplainFindingInput,
  LlamaCppCompletionResponse,
} from './types.js'
