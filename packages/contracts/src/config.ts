export type ViewportProfile = 'desktop-only' | 'mobile-only' | 'responsive' | 'custom';

export interface ViewportsConfig {
  profile: ViewportProfile;
  minWidth: number;
  maxWidth: number;
  widths: number[];
  height?: number;
  required?: boolean;
}

export interface ProjectConfig {
  name: string;
  baseUrl: string;
  routes: string[];
}

export interface ChecksConfig {
  responsive: boolean;
  visualRegression: boolean;
  failOnScannerError: boolean;
}

export type SeverityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'informational';
export type SeverityAction = 'block' | 'require-waiver' | 'allow';

export type SeverityPolicyConfig = Record<SeverityLevel, SeverityAction>;

export interface WaiversConfig {
  file: string;
  requireReason: boolean;
  allowExpiry: boolean;
}

export interface AIConfig {
  provider: 'local';
  endpoint?: string;
  model?: string;
  requiredForExplanations: boolean;
  requiredForFixSuggestions: boolean;
}

export interface PixelBreakConfig {
  version: number;
  project: ProjectConfig;
  viewports: ViewportsConfig;
  checks: ChecksConfig;
  severity: SeverityPolicyConfig;
  waivers: WaiversConfig;
  ai: AIConfig;
}
