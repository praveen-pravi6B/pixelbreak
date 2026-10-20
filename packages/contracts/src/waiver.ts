import type { SeverityLevel } from './config.js';

export interface Waiver {
  id: string;
  findingId?: string;
  ruleId?: string;
  route?: string;
  viewportWidth?: number;
  maxSeverityAllowed?: SeverityLevel;
  reason: string;
  author?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface WaiversFile {
  version: number;
  waivers: Waiver[];
}
