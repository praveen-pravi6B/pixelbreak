import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { evaluatePolicy, loadWaiversFile, saveWaiversFile } from '@pixelbreak/policy-engine';
import { installPreCommitHook, isPreCommitHookInstalled, removePreCommitHook } from '@pixelbreak/git-integration';
import { loadConfig } from '@pixelbreak/config';
import type { Finding, Waiver } from '@pixelbreak/contracts';

describe('Phase D --- Policy Engine and Git Gate E2E', () => {
  let tempDir: string;
  const configPath = path.resolve(process.cwd(), '.pixelbreak.yml');

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelbreak-gate-'));
    fs.mkdirSync(path.join(tempDir, '.git'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('high severity findings block commit gate even if a waiver is present', () => {
    const config = loadConfig(configPath);
    const highFinding: Finding = {
      id: 'finding-overflow-1024',
      scanId: 'scan-policy-1',
      toolVersion: '0.1.0',
      timestamp: new Date().toISOString(),
      ruleId: 'horizontal-overflow',
      severity: 'high',
      category: 'layout',
      route: '/',
      viewport: { width: 1024, height: 900 },
      selector: '#metrics-card',
      summary: 'Horizontal overflow detected',
      evidence: { description: 'Exceeds viewport' },
      status: 'open',
    };

    // Waiver attempts to suppress high finding
    const attemptedWaiver: Waiver = {
      id: 'waiver-attempt-high',
      findingId: 'finding-overflow-1024',
      reason: 'Attempting to bypass high severity',
      createdAt: '2026-10-20T00:00:00Z',
    };

    const result = evaluatePolicy({
      findings: [highFinding],
      config,
      waivers: [attemptedWaiver],
      scanId: 'scan-policy-1',
    });

    expect(result.decision).toBe('block');
    expect(result.blockedCount).toBe(1);
    expect(result.waivedCount).toBe(0);
  });

  it('valid scoped moderate waiver satisfies policy gate and allows commit', () => {
    const config = loadConfig(configPath);
    const modFinding: Finding = {
      id: 'finding-visual-diff-1280',
      scanId: 'scan-policy-2',
      toolVersion: '0.1.0',
      timestamp: new Date().toISOString(),
      ruleId: 'visual-regression',
      severity: 'moderate',
      category: 'visual-regression',
      route: '/',
      viewport: { width: 1280, height: 900 },
      summary: 'Visual regression: 0.8% difference',
      evidence: { description: 'Minor styling shift' },
      status: 'open',
    };

    const validWaiver: Waiver = {
      id: 'waiver-header-color',
      ruleId: 'visual-regression',
      route: '/',
      viewportWidth: 1280,
      reason: 'Temporary header brand color refresh in progress',
      author: 'frontend-lead@example.com',
      createdAt: '2026-10-15T00:00:00Z',
      expiresAt: '2026-11-15T00:00:00Z',
    };

    const waiversFilePath = path.join(tempDir, '.pixelbreak-waivers.yml');
    saveWaiversFile(waiversFilePath, [validWaiver]);
    const loadedWaivers = loadWaiversFile(waiversFilePath);

    const result = evaluatePolicy({
      findings: [modFinding],
      config,
      waivers: loadedWaivers,
      scanId: 'scan-policy-2',
      now: new Date('2026-10-20T00:00:00Z'),
    });

    expect(result.decision).toBe('pass');
    expect(result.blockedCount).toBe(0);
    expect(result.waivedCount).toBe(1);
    expect(result.findings[0].waived).toBe(true);
    expect(result.findings[0].waiverId).toBe('waiver-header-color');
  });

  it('expired waiver fails to satisfy policy gate and blocks commit', () => {
    const config = loadConfig(configPath);
    const modFinding: Finding = {
      id: 'finding-clipping-1024',
      scanId: 'scan-policy-3',
      toolVersion: '0.1.0',
      timestamp: new Date().toISOString(),
      ruleId: 'element-clipping',
      severity: 'moderate',
      category: 'layout',
      route: '/',
      viewport: { width: 1024, height: 900 },
      summary: 'Element clipping detected',
      evidence: { description: 'Clipped' },
      status: 'open',
    };

    const expiredWaiver: Waiver = {
      id: 'waiver-expired',
      findingId: 'finding-clipping-1024',
      reason: 'Waiver that expired last week',
      createdAt: '2026-10-01T00:00:00Z',
      expiresAt: '2026-10-10T00:00:00Z', // Expired
    };

    const result = evaluatePolicy({
      findings: [modFinding],
      config,
      waivers: [expiredWaiver],
      scanId: 'scan-policy-3',
      now: new Date('2026-10-20T00:00:00Z'),
    });

    expect(result.decision).toBe('block');
    expect(result.blockedCount).toBe(1);
    expect(result.waivedCount).toBe(0);
  });

  it('installs pre-commit Git hook that integrates with repository policy', () => {
    const installResult = installPreCommitHook(tempDir);
    expect(installResult.success).toBe(true);
    expect(isPreCommitHookInstalled(tempDir)).toBe(true);

    const hookContent = fs.readFileSync(installResult.hookPath!, 'utf-8');
    expect(hookContent).toContain('PIXELBREAK_BYPASS');
    expect(hookContent).toContain('check');

    removePreCommitHook(tempDir);
    expect(isPreCommitHookInstalled(tempDir)).toBe(false);
  });
});
