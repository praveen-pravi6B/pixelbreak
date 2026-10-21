// Inline type definitions matching @pixelbreak/contracts
// (avoids bundler complexity in a Vite React app)

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'informational'
export type PolicyDecision = 'pass' | 'block' | 'needs-review'
export type FindingCategory = 'layout' | 'visual-regression' | 'scanner' | 'ai'
export type FindingStatus = 'open' | 'waived' | 'fixed' | 'approved-baseline'

export interface ElementGeometry {
  x: number
  y: number
  width: number
  height: number
  scrollWidth?: number
  scrollHeight?: number
  clientWidth?: number
  clientHeight?: number
}

export interface ComputedCSS {
  overflow?: string
  overflowX?: string
  overflowY?: string
  display?: string
  position?: string
  width?: string
  maxWidth?: string
  boxSizing?: string
  [property: string]: string | undefined
}

export interface FindingEvidence {
  description: string
  measuredGeometry?: ElementGeometry
  viewportGeometry?: { width: number; height: number }
  computedStyles?: ComputedCSS
  diffPercentage?: number
  diffPixels?: number
  [key: string]: unknown
}

export interface PatchProposal {
  cssSelector: string
  property: string
  currentValue: string
  proposedValue: string
  diff: string
  explanation: string
  expectedEffect: string
  validationSteps: string[]
}

export interface AiExplanation {
  findingId: string
  severity: SeverityLevel
  isHypothesis: true
  summary: string
  likelyCause: string
  supportingEvidence: string[]
  patch: PatchProposal | null
  limitations: string
}

export interface Finding {
  id: string
  scanId: string
  toolVersion: string
  timestamp: string
  ruleId: string
  severity: SeverityLevel
  category: FindingCategory
  route: string
  viewport: { width: number; height: number }
  selector?: string
  summary: string
  evidence: FindingEvidence
  baselineImage?: string
  currentImage?: string
  diffImage?: string
  aiExplanation?: string
  rootCauseHypotheses?: string[]
  suggestedPatch?: {
    file: string
    cssSelector: string
    diff: string
    explanation: string
  }
  status: FindingStatus
}

export interface FindingEvaluation {
  finding: Finding
  action: 'block' | 'require-waiver' | 'allow'
  waived: boolean
  waiverId?: string
  reasons: string[]
}

export interface PolicyEvaluationResult {
  scanId: string
  decision: PolicyDecision
  blockedCount: number
  waivedCount: number
  allowedCount: number
  findings: FindingEvaluation[]
  summary: string
  severityCounts: Record<SeverityLevel, number>
}

export interface ScanReport {
  scanId: string
  toolVersion: string
  timestamp: string
  gitCommit?: string
  gitBranch?: string
  config?: {
    project?: { name?: string; baseUrl?: string }
    viewports?: { widths?: number[]; profile?: string }
    [key: string]: unknown
  }
  policyResult: PolicyEvaluationResult
  findings: Finding[]
  routesScanned: string[]
  viewportsScanned: number[]
  durationMs: number
}

// Per-finding AI explanation enriched by the engine
export interface EnrichedReport extends ScanReport {
  aiExplanations?: Record<string, AiExplanation>
}
