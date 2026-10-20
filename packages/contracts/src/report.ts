import type { Finding } from './finding.js';
import type { PixelBreakConfig } from './config.js';
import type { PolicyEvaluationResult } from './policy.js';

export interface ScanReport {
  scanId: string;
  toolVersion: string;
  timestamp: string;
  gitCommit?: string;
  gitBranch?: string;
  config: PixelBreakConfig;
  policyResult: PolicyEvaluationResult;
  findings: Finding[];
  routesScanned: string[];
  viewportsScanned: number[];
  durationMs: number;
}
