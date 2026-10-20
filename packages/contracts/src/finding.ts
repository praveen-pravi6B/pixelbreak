import type { SeverityLevel } from './config.js';

export type FindingCategory = 'layout' | 'visual-regression' | 'scanner' | 'ai';

export type FindingStatus = 'open' | 'waived' | 'fixed' | 'approved-baseline';

export interface ViewportDimensions {
  width: number;
  height: number;
}

export interface ElementGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  scrollWidth?: number;
  scrollHeight?: number;
  clientWidth?: number;
  clientHeight?: number;
}

export interface ComputedCSS {
  overflow?: string;
  overflowX?: string;
  overflowY?: string;
  display?: string;
  position?: string;
  width?: string;
  maxWidth?: string;
  boxSizing?: string;
  [property: string]: string | undefined;
}

export interface FindingEvidence {
  description: string;
  measuredGeometry?: ElementGeometry;
  viewportGeometry?: ViewportDimensions;
  computedStyles?: ComputedCSS;
  diffPercentage?: number;
  diffPixels?: number;
  [key: string]: unknown;
}

export interface SuggestedPatch {
  file: string;
  cssSelector: string;
  diff: string;
  explanation: string;
}

export interface Finding {
  id: string;
  scanId: string;
  toolVersion: string;
  timestamp: string;
  ruleId: string;
  severity: SeverityLevel;
  category: FindingCategory;
  route: string;
  viewport: ViewportDimensions;
  selector?: string;
  summary: string;
  evidence: FindingEvidence;
  baselineImage?: string;
  currentImage?: string;
  diffImage?: string;
  aiExplanation?: string;
  rootCauseHypotheses?: string[];
  suggestedPatch?: SuggestedPatch;
  status: FindingStatus;
}
