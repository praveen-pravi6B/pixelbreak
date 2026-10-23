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

  it('detects known horizontal overflow at mobile/tablet/1024px and passes at larger viewports', async () => {
    const config = loadConfig(configPath);
    // Config may be desktop-only or responsive depending on .pixelbreak.yml
    const configuredWidths = config.viewports.widths;
    expect(configuredWidths.length).toBeGreaterThan(0);

    const scanner = new Scanner({
      config,
      scanId: 'e2e-test-scan',
    });

    const result = await scanner.run();

    // 1. Verify exactly the configured widths were scanned (no extras, no missing)
    expect(result.viewportsScanned.sort((a, b) => a - b))
      .toEqual([...configuredWidths].sort((a, b) => a - b));

    // 2. Verify screenshot artifacts exist for every scanned viewport
    for (const width of result.viewportsScanned) {
      const screenshotKey = `/-${width}`;
      expect(result.screenshots[screenshotKey]).toBeDefined();
      expect(fs.existsSync(result.screenshots[screenshotKey])).toBe(true);
    }

    // 3. Verify horizontal overflow detected — the fixture has min-width: 1200px
    // so it must overflow at any viewport narrower than 1200px
    const overflowFindings = result.findings.filter(
      (f) => f.ruleId === 'horizontal-overflow'
    );
    expect(overflowFindings.length).toBeGreaterThan(0);

    // At least one overflow finding must be HIGH severity
    const highFindings = overflowFindings.filter((f) => f.severity === 'high');
    expect(highFindings.length).toBeGreaterThan(0);

    // All overflow findings should reference the metrics element
    for (const f of overflowFindings) {
      expect(f.selector).toMatch(/metrics/);
      expect(f.evidence).toBeDefined();
    }

    // 4. Viewports >= 1280px must have NO overflow (min-width: 1200px fits within them)
    const wideViewports = result.viewportsScanned.filter((w) => w >= 1280);
    for (const width of wideViewports) {
      const overflowAtWidth = overflowFindings.find((f) => f.viewport.width === width);
      expect(overflowAtWidth).toBeUndefined();
    }

    // 5. Widths outside the configured range are never scanned
    const outOfRangeWidths = [200, 320, 2560, 4096];
    for (const w of outOfRangeWidths) {
      if (!configuredWidths.includes(w)) {
        expect(result.viewportsScanned).not.toContain(w);
        expect(result.findings.some((f) => f.viewport.width === w)).toBe(false);
      }
    }
  }, 60000);
});
