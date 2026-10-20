import { describe, it, expect } from 'vitest';
import { evaluatePolicy, evaluateWaiverMatch } from '../src/evaluator.js';
import type { Finding, PixelBreakConfig, Waiver } from '@pixelbreak/contracts';

describe('@pixelbreak/policy-engine', () => {
  const baseConfig: PixelBreakConfig = {
    version: 1,
    project: { name: 'test', baseUrl: 'http://localhost:4173', routes: ['/'] },
    viewports: { profile: 'desktop-only', minWidth: 1024, maxWidth: 1920, widths: [1024] },
    checks: { responsive: true, visualRegression: true, failOnScannerError: true },
    severity: {
      critical: 'block',
      high: 'block',
      moderate: 'require-waiver',
      low: 'allow',
      informational: 'allow',
    },
    waivers: { file: '.pixelbreak-waivers.yml', requireReason: true, allowExpiry: true },
    ai: { provider: 'local', requiredForExplanations: true, requiredForFixSuggestions: true },
  };

  const createFinding = (id: string, severity: Finding['severity'], ruleId = 'horizontal-overflow'): Finding => ({
    id,
    scanId: 'scan-1',
    toolVersion: '0.1.0',
    timestamp: new Date().toISOString(),
    ruleId,
    severity,
    category: 'layout',
    route: '/',
    viewport: { width: 1024, height: 900 },
    summary: 'Test finding',
    evidence: { description: 'Test' },
    status: 'open',
  });

  it('blocks high and critical findings unconditionally', () => {
    const highFinding = createFinding('find-high', 'high');
    const result = evaluatePolicy({
      findings: [highFinding],
      config: baseConfig,
      scanId: 'scan-1',
    });

    expect(result.decision).toBe('block');
    expect(result.blockedCount).toBe(1);
  });

  it('blocks moderate finding when no waiver exists', () => {
    const modFinding = createFinding('find-mod', 'moderate');
    const result = evaluatePolicy({
      findings: [modFinding],
      config: baseConfig,
      scanId: 'scan-1',
    });

    expect(result.decision).toBe('block');
    expect(result.blockedCount).toBe(1);
    expect(result.findings[0].waived).toBe(false);
  });

  it('allows moderate finding when valid scoped waiver matches', () => {
    const modFinding = createFinding('find-mod', 'moderate', 'visual-regression');
    const waiver: Waiver = {
      id: 'waiver-1',
      ruleId: 'visual-regression',
      route: '/',
      viewportWidth: 1024,
      reason: 'Intentional branding update pending design sign-off',
      createdAt: '2026-10-01T00:00:00Z',
      expiresAt: '2026-11-01T00:00:00Z',
    };

    const result = evaluatePolicy({
      findings: [modFinding],
      config: baseConfig,
      waivers: [waiver],
      scanId: 'scan-1',
      now: new Date('2026-10-15T00:00:00Z'),
    });

    expect(result.decision).toBe('pass');
    expect(result.blockedCount).toBe(0);
    expect(result.waivedCount).toBe(1);
    expect(result.findings[0].waived).toBe(true);
    expect(result.findings[0].waiverId).toBe('waiver-1');
  });

  it('rejects waiver for high/critical findings (cannot suppress high/critical)', () => {
    const highFinding = createFinding('find-high', 'high', 'horizontal-overflow');
    const waiver: Waiver = {
      id: 'waiver-illegal',
      findingId: 'find-high',
      reason: 'Trying to waive high issue',
      createdAt: '2026-10-01T00:00:00Z',
    };

    const match = evaluateWaiverMatch(waiver, highFinding, baseConfig);
    expect(match.matched).toBe(false);
    expect(match.reason).toContain('cannot suppress high severity');

    const result = evaluatePolicy({
      findings: [highFinding],
      config: baseConfig,
      waivers: [waiver],
      scanId: 'scan-1',
    });
    expect(result.decision).toBe('block');
  });

  it('rejects expired waiver', () => {
    const modFinding = createFinding('find-mod', 'moderate');
    const expiredWaiver: Waiver = {
      id: 'waiver-expired',
      findingId: 'find-mod',
      reason: 'Temporary fix',
      createdAt: '2026-09-01T00:00:00Z',
      expiresAt: '2026-10-01T00:00:00Z',
    };

    const result = evaluatePolicy({
      findings: [modFinding],
      config: baseConfig,
      waivers: [expiredWaiver],
      scanId: 'scan-1',
      now: new Date('2026-10-15T00:00:00Z'), // current date is after expiry
    });

    expect(result.decision).toBe('block');
    expect(result.waivedCount).toBe(0);
  });

  it('rejects waiver missing reason when requireReason is enabled', () => {
    const modFinding = createFinding('find-mod', 'moderate');
    const emptyReasonWaiver: Waiver = {
      id: 'waiver-no-reason',
      findingId: 'find-mod',
      reason: '   ',
      createdAt: '2026-10-01T00:00:00Z',
    };

    const match = evaluateWaiverMatch(emptyReasonWaiver, modFinding, baseConfig);
    expect(match.matched).toBe(false);
    expect(match.reason).toContain('requireReason');
  });
});
