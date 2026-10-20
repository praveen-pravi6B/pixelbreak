import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from '@pixelbreak/runner';
import { updateBaselinesFromScreenshots } from '@pixelbreak/visual-diff';

const TEST_PORT = 4174;
const BASE_URL = `http://localhost:${TEST_PORT}`;

describe('Phase C --- PixelTruth Visual Regression E2E', () => {
  let server: http.Server;
  let injectChange = false;
  const configPath = path.resolve(process.cwd(), '.pixelbreak.yml');
  const distDir = path.resolve(process.cwd(), 'fixtures/broken-demo/dist');
  const testOutputDir = path.resolve(process.cwd(), '.pixelbreak/test-pixeltruth');

  beforeAll(async () => {
    // Clean test output dir
    fs.rmSync(testOutputDir, { recursive: true, force: true });
    fs.mkdirSync(testOutputDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      server = http.createServer((req, res) => {
        let reqPath = req.url?.split('?')[0] || '/';
        if (reqPath === '/' || !path.extname(reqPath)) {
          reqPath = '/index.html';
        }
        const filePath = path.join(distDir, reqPath);
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath);
          if (ext === '.html' && injectChange) {
            // Controlled visual change: inject a bright red notification banner across the top
            let html = fs.readFileSync(filePath, 'utf-8');
            html = html.replace(
              '<body>',
              '<body><div id="controlled-visual-diff" style="background: #ef4444; color: white; padding: 24px; text-align: center; font-size: 24px; font-weight: bold;">CONTROLLED REGRESSION TEST BANNER</div>'
            );
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
          }

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

      server.listen(TEST_PORT, () => resolve());
      server.on('error', reject);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('verifies baseline creation, identical match pass, and controlled visual diff detection', async () => {
    const baseConfig = loadConfig(configPath);
    // Point config to isolated test port
    const config = {
      ...baseConfig,
      project: {
        ...baseConfig.project,
        baseUrl: BASE_URL,
      },
    };

    // 1. Step 1: Capture initial screenshots and explicitly create baselines
    const baselineScanner = new Scanner({
      config,
      outputDir: testOutputDir,
      scanId: 'baseline-run',
    });

    const baselineScanResult = await baselineScanner.run();
    expect(Object.keys(baselineScanResult.screenshots).length).toBe(4);

    const { updatedFiles } = updateBaselinesFromScreenshots(
      baselineScanResult.screenshots,
      baselineScanner.baselineDir
    );
    expect(updatedFiles.length).toBe(4);
    for (const f of updatedFiles) {
      expect(fs.existsSync(f)).toBe(true);
    }

    // 2. Step 2: Run scan on unchanged application -> visual diff passes with 0 visual regression findings
    const verifyScanner = new Scanner({
      config,
      outputDir: testOutputDir,
      scanId: 'unchanged-run',
    });

    const unchangedResult = await verifyScanner.run();
    expect(unchangedResult.hasBaselines).toBe(true);
    const visualFindingsUnchanged = unchangedResult.findings.filter(
      (f) => f.ruleId === 'visual-regression'
    );
    expect(visualFindingsUnchanged).toHaveLength(0);

    // 3. Step 3: Introduce controlled visual change
    injectChange = true;

    const modifiedScanner = new Scanner({
      config,
      outputDir: testOutputDir,
      scanId: 'modified-run',
    });

    const modifiedResult = await modifiedScanner.run();
    const visualFindingsModified = modifiedResult.findings.filter(
      (f) => f.ruleId === 'visual-regression'
    );

    // Controlled change should be detected across all viewports
    expect(visualFindingsModified.length).toBe(4);

    for (const finding of visualFindingsModified) {
      expect(finding.category).toBe('visual-regression');
      expect(finding.severity).toMatch(/high|moderate/);
      expect(finding.evidence.diffPercentage).toBeGreaterThan(0.5);
      expect(finding.evidence.diffPixels).toBeGreaterThan(100);
      expect(finding.diffImage).toBeDefined();
      expect(fs.existsSync(finding.diffImage!)).toBe(true);
      expect(fs.existsSync(finding.baselineImage!)).toBe(true);
      expect(fs.existsSync(finding.currentImage!)).toBe(true);
      // Changed bounding box was measured
      expect(finding.evidence.measuredGeometry).toBeDefined();
      expect(finding.evidence.measuredGeometry?.width).toBeGreaterThan(0);
    }

    // 4. Step 4: Revert change -> verifies clean pass restored
    injectChange = false;
    const restoredScanner = new Scanner({
      config,
      outputDir: testOutputDir,
      scanId: 'restored-run',
    });

    const restoredResult = await restoredScanner.run();
    const visualFindingsRestored = restoredResult.findings.filter(
      (f) => f.ruleId === 'visual-regression'
    );
    expect(visualFindingsRestored).toHaveLength(0);
  }, 45000);
});
