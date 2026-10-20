import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from '@pixelbreak/runner';

describe('Phase B --- Breakpoint Detective E2E', () => {
  let serverProcess: ChildProcess;
  const configPath = path.resolve(process.cwd(), '.pixelbreak.yml');

  beforeAll(async () => {
    // Start preview server on port 4173
    serverProcess = spawn(
      'pnpm',
      ['--filter', '@pixelbreak/broken-demo', 'preview', '--port', '4173'],
      {
        stdio: 'pipe',
        env: {
          ...process.env,
          PATH: `/home/praveen/.nvm/versions/node/v22.17.1/bin:${process.env.PATH}`,
        },
      }
    );

    // Wait until server is listening
    let ready = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://localhost:4173');
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (!ready) {
      throw new Error('Failed to start demo preview server on http://localhost:4173');
    }
  }, 15000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
  });

  it('detects known horizontal overflow at 1024px and passes at 1280px, 1440px, 1920px', async () => {
    const config = loadConfig(configPath);
    expect(config.viewports.profile).toBe('desktop-only');
    expect(config.viewports.widths).toEqual([1024, 1280, 1440, 1920]);

    const scanner = new Scanner({
      config,
      scanId: 'e2e-test-scan',
    });

    const result = await scanner.run();

    // 1. Verify viewports scanned matches ONLY configured desktop widths
    expect(result.viewportsScanned).toEqual([1024, 1280, 1440, 1920]);

    // Explicitly verify mobile / out-of-scope widths are NOT tested or reported
    expect(result.viewportsScanned).not.toContain(375);
    expect(result.viewportsScanned).not.toContain(768);
    expect(result.findings.some((f) => f.viewport.width < 1024)).toBe(false);

    // 2. Verify screenshot artifacts were captured for every configured viewport
    for (const width of [1024, 1280, 1440, 1920]) {
      const screenshotKey = `/-${width}`;
      expect(result.screenshots[screenshotKey]).toBeDefined();
      expect(fs.existsSync(result.screenshots[screenshotKey])).toBe(true);
    }

    // 3. Verify horizontal overflow detected at 1024px
    const overflowFindings = result.findings.filter(
      (f) => f.ruleId === 'horizontal-overflow'
    );
    expect(overflowFindings.length).toBeGreaterThan(0);

    const findingAt1024 = overflowFindings.find((f) => f.viewport.width === 1024);
    expect(findingAt1024).toBeDefined();
    expect(findingAt1024?.severity).toBe('high');
    expect(findingAt1024?.selector).toMatch(/metrics-card|metrics-container/);
    expect(findingAt1024?.evidence.overflowAmount).toBeGreaterThan(0);

    // 4. Verify no horizontal overflow detected at 1280px, 1440px, or 1920px
    const findingAt1280 = overflowFindings.find((f) => f.viewport.width === 1280);
    const findingAt1440 = overflowFindings.find((f) => f.viewport.width === 1440);
    const findingAt1920 = overflowFindings.find((f) => f.viewport.width === 1920);

    expect(findingAt1280).toBeUndefined();
    expect(findingAt1440).toBeUndefined();
    expect(findingAt1920).toBeUndefined();
  }, 30000);
});
