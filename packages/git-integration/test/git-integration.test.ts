import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  installPreCommitHook,
  isPreCommitHookInstalled,
  removePreCommitHook,
  generatePreCommitScript,
} from '../src/hook.js';

describe('@pixelbreak/git-integration', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pixelbreak-git-test-'));
    fs.mkdirSync(path.join(tempDir, '.git'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('generates pre-commit script containing bypass environment variable and marker', () => {
    const script = generatePreCommitScript();
    expect(script).toContain('PIXELBREAK_BYPASS');
    expect(script).toContain('# PixelBreak Pre-Commit Hook');
  });

  it('installs pre-commit hook into .git/hooks directory and sets permissions', () => {
    const result = installPreCommitHook(tempDir);
    expect(result.success).toBe(true);
    expect(result.hookPath).toBeDefined();
    expect(fs.existsSync(result.hookPath!)).toBe(true);
    expect(isPreCommitHookInstalled(tempDir)).toBe(true);

    const stat = fs.statSync(result.hookPath!);
    // Check executable bit is set
    expect(stat.mode & 0o111).toBeGreaterThan(0);
  });

  it('removes pre-commit hook cleanly', () => {
    installPreCommitHook(tempDir);
    expect(isPreCommitHookInstalled(tempDir)).toBe(true);

    const removed = removePreCommitHook(tempDir);
    expect(removed).toBe(true);
    expect(isPreCommitHookInstalled(tempDir)).toBe(false);
  });

  it('returns failure when not a git repository', () => {
    const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));
    try {
      const result = installPreCommitHook(nonGitDir);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Not a git repository');
    } finally {
      fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
  });
});
