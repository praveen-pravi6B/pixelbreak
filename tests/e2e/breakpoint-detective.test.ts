import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from '@pixelbreak/runner';

describe('Phase B --- Breakpoint Detective E2E', () => {
  let server: http.Server;
  const configPath = path.resolve(process.cwd(), '.pixelbreak.yml');
  const distDir = path.resolve(process.cwd(), 'fixtures/broken-demo/dist');

  beforeAll(async () => {
    // Start pure Node.js HTTP server on port 4173 for demo dist
    await new Promise<void>((resolve, reject) => {
      server = http.createServer((req, res) => {
        let reqPath = req.url?.split('?')[0] || '/';
        if (reqPath === '/' || !path.extname(reqPath)) {
          reqPath = '/index.html';
        }
        const filePath = path.join(distDir, reqPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          const contentType =
            ext === '.html'
              ? 'text/html'
              : ext === '.css'
              ? 'text/css'
              : ext === '.js'
              ? 'application/javascript'
              : 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(filePath).pipe(res);
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      server.listen(4173, () => resolve());
      server.on('error', reject);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
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
