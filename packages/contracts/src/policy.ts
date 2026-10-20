import type { Finding } from './finding.js';
import type { SeverityLevel } from './config.js';

export type PolicyDecision = 'pass' | 'block' | 'needs-review';

export interface FindingEvaluation {
  finding: Finding;
  action: 'block' | 'require-waiver' | 'allow';
  waived: boolean;
  waiverId?: string;
  reasons: string[];
}

export interface PolicyEvaluationResult {
  scanId: string;
  decision: PolicyDecision;
  blockedCount: number;
  waivedCount: number;
  allowedCount: number;
  findings: FindingEvaluation[];
  summary: string;
  severityCounts: Record<SeverityLevel, number>;
}
