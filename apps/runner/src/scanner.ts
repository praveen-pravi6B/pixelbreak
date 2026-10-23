import path from 'node:path';
import fs from 'node:fs';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { PixelBreakConfig, Finding } from '@pixelbreak/contracts';
import {
  inPageDetectHorizontalOverflow,
  createHorizontalOverflowFindings,
  inPageDetectElementClipping,
  createElementClippingFindings,
  type OverflowElementInfo,
  type ClippedElementInfo,
} from '@pixelbreak/layout-analyzer';
import {
  compareImages,
  createVisualDiffFinding,
  getBaselinePath,
  sanitizeRouteName,
} from '@pixelbreak/visual-diff';
import { getStagedFileSwaps, withHeadVersions, type StagedFileSwap } from './git-baseline.js';

export interface ScannerOptions {
  config: PixelBreakConfig;
  scanId?: string;
  outputDir?: string;
  toolVersion?: string;
}

export interface ScanResult {
  scanId: string;
  timestamp: string;
  findings: Finding[];
  routesScanned: string[];
  viewportsScanned: number[];
  screenshots: Record<string, string>; // key: `${route}-${width}` -> absolute path
  diffImages: Record<string, string>; // key: `${route}-${width}` -> absolute path
  hasBaselines: boolean;
  durationMs: number;
}

export class Scanner {
  public readonly config: PixelBreakConfig;
  public readonly scanId: string;
  public readonly outputDir: string;
  public readonly baselineDir: string;
  public readonly toolVersion: string;

  constructor(options: ScannerOptions) {
    this.config = options.config;
    // Include random suffix to prevent ID collision when two scans start in the same ms
    this.scanId = options.scanId ?? `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.outputDir = options.outputDir ?? path.join(process.cwd(), '.pixelbreak');
    this.baselineDir = path.join(this.outputDir, 'baselines');
    this.toolVersion = options.toolVersion ?? '0.1.0';
  }

  async run(): Promise<ScanResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const screenshots: Record<string, string> = {};
    const diffImages: Record<string, string> = {};

    const screenshotsDir = path.join(this.outputDir, 'artifacts', 'screenshots', this.scanId);
    const diffsDir = path.join(this.outputDir, 'artifacts', 'diffs', this.scanId);
    const gitBaselinesDir = path.join(this.outputDir, 'artifacts', 'git-baselines', this.scanId);
    fs.mkdirSync(screenshotsDir, { recursive: true });
    fs.mkdirSync(diffsDir, { recursive: true });

    // Enforce configured viewport profile constraints
    const widthsToTest = this.config.viewports.widths.filter((w) => {
      return w >= this.config.viewports.minWidth && w <= this.config.viewports.maxWidth;
    });

    // Guard: if all widths are filtered out the scan would silently produce 0 findings
    if (widthsToTest.length === 0) {
      throw new Error(
        `No viewport widths to test: all configured widths [${this.config.viewports.widths.join(', ')}]px ` +
        `fall outside the range [${this.config.viewports.minWidth}–${this.config.viewports.maxWidth}]px. ` +
        `Check minWidth/maxWidth in .pixelbreak.yml.`
      );
    }

    // Detect staged files for git-aware automatic baseline (no manual baseline update needed)
    const stagedSwaps = this.config.checks.visualRegression
      ? getStagedFileSwaps(process.cwd())
      : [];
    const useGitBaseline = stagedSwaps.length > 0;

    if (useGitBaseline) {
      fs.mkdirSync(gitBaselinesDir, { recursive: true });
      console.log(`   Git baseline: ${stagedSwaps.length} staged file(s) detected — comparing against HEAD automatically.`);
    }

    const browser: Browser = await chromium.launch({
      headless: true,
    });

    // Global scan timeout — prevents pre-commit hook hanging indefinitely
    const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
    const scanTimeoutHandle = setTimeout(() => {
      console.error('\n⚠️  PixelBreak: scan timed out after 5 minutes. Closing browser.');
      browser.close().catch(() => {});
      process.exit(2);
    }, SCAN_TIMEOUT_MS);

    let anyBaselineFound = false;

    try {
      for (const route of this.config.project.routes) {
        const fullUrl = new URL(route, this.config.project.baseUrl).toString();

        for (const width of widthsToTest) {
          const height = this.config.viewports.height ?? 900;
          const context: BrowserContext = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
          });

          const page: Page = await context.newPage();

          try {
            // Disable animations and transitions to eliminate screenshot noise
            await page.addInitScript(() => {
              const css = `
                *, *::before, *::after {
                  -webkit-transition: none !important;
                  -moz-transition: none !important;
                  -o-transition: none !important;
                  -ms-transition: none !important;
                  transition: none !important;
                  -webkit-animation: none !important;
                  -moz-animation: none !important;
                  -o-animation: none !important;
                  -ms-animation: none !important;
                  animation: none !important;
                }
              `;
              const style = document.createElement('style');
              style.textContent = css;
              document.head ? document.head.appendChild(style) : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
            });

            // Navigate — fail loudly if the app is unreachable so we never
            // silently produce a false-passing scan with 0 findings
            try {
              await page.goto(fullUrl, {
                waitUntil: 'domcontentloaded',
                timeout: 15000,
              });
            } catch (navErr) {
              const reason = navErr instanceof Error ? navErr.message : String(navErr);
              if (this.config.checks.failOnScannerError) {
                throw new Error(
                  `Cannot reach ${fullUrl} at ${width}px. Is your dev server running at ${this.config.project.baseUrl}?\n  ${reason}`
                );
              }
              console.warn(`   ⚠️  Skipping ${route} @ ${width}px — navigation failed: ${reason}`);
              continue;
            }

            await page.waitForTimeout(300);

            // Screenshot capture
            const sanitizedRoute = sanitizeRouteName(route);
            const screenshotFileName = `${sanitizedRoute}_${width}px.png`;
            const screenshotPath = path.join(screenshotsDir, screenshotFileName);

            await page.screenshot({
              path: screenshotPath,
              fullPage: false,
            });

            const screenshotKey = `${route}-${width}`;
            screenshots[screenshotKey] = screenshotPath;

            // 1. Run deterministic Horizontal Overflow Detection
            if (this.config.checks.responsive) {
              const overflowElements: OverflowElementInfo[] = await page.evaluate(
                inPageDetectHorizontalOverflow,
                { width, height }
              );

              if (overflowElements.length > 0) {
                const overflowFindings = createHorizontalOverflowFindings(overflowElements, {
                  scanId: this.scanId,
                  toolVersion: this.toolVersion,
                  route,
                  viewport: { width, height },
                });

                for (const f of overflowFindings) {
                  f.currentImage = screenshotPath;
                  findings.push(f);
                }
              }

              // 2. Run deterministic Element Clipping Detection
              const clippedElements: ClippedElementInfo[] = await page.evaluate(
                inPageDetectElementClipping
              );

              if (clippedElements.length > 0) {
                const clippingFindings = createElementClippingFindings(clippedElements, {
                  scanId: this.scanId,
                  toolVersion: this.toolVersion,
                  route,
                  viewport: { width, height },
                });

                for (const f of clippingFindings) {
                  f.currentImage = screenshotPath;
                  findings.push(f);
                }
              }
            }

            // 3. PixelTruth: Visual Regression Diffing
            if (this.config.checks.visualRegression) {
              let baselineBuf: Buffer | null = null;
              let baselineImagePath = '';

              // Priority 1: Git-aware automatic baseline (staged files → HEAD version)
              if (useGitBaseline) {
                const gitBaselinePath = path.join(gitBaselinesDir, `${sanitizedRoute}_${width}px.png`);
                const captured = await this.captureGitBaseline(
                  browser, fullUrl, width, height, stagedSwaps, gitBaselinePath
                );
                if (captured) {
                  baselineBuf = fs.readFileSync(gitBaselinePath);
                  baselineImagePath = gitBaselinePath;
                  anyBaselineFound = true;
                }
              }

              // Priority 2: Stored baseline (from pixelbreak baseline update)
              if (!baselineBuf) {
                const storedBaselinePath = getBaselinePath(this.baselineDir, route, width);
                if (fs.existsSync(storedBaselinePath)) {
                  baselineBuf = fs.readFileSync(storedBaselinePath);
                  baselineImagePath = storedBaselinePath;
                  anyBaselineFound = true;
                }
              }

              if (baselineBuf) {
                const currentBuf = fs.readFileSync(screenshotPath);
                const diffResult = compareImages(baselineBuf, currentBuf);

                let diffImagePath = '';
                if (diffResult.diffPixels > 0) {
                  const diffFileName = `${sanitizedRoute}_${width}px_diff.png`;
                  diffImagePath = path.join(diffsDir, diffFileName);
                  fs.writeFileSync(diffImagePath, diffResult.diffImageBuffer);
                  diffImages[screenshotKey] = diffImagePath;
                }

                const visualFinding = createVisualDiffFinding(diffResult, {
                  scanId: this.scanId,
                  toolVersion: this.toolVersion,
                  route,
                  viewport: { width, height },
                  baselineImagePath,
                  currentImagePath: screenshotPath,
                  diffImagePath: diffImagePath || screenshotPath,
                });

                if (visualFinding) {
                  findings.push(visualFinding);
                }
              }
            }
          } finally {
            await context.close();
          }
        }
      }
    } finally {
      clearTimeout(scanTimeoutHandle);
      await browser.close();
    }

    const durationMs = Date.now() - startTime;

    return {
      scanId: this.scanId,
      timestamp: new Date().toISOString(),
      findings,
      routesScanned: this.config.project.routes,
      viewportsScanned: widthsToTest,
      screenshots,
      diffImages,
      hasBaselines: anyBaselineFound,
      durationMs,
    };
  }

  /**
   * Temporarily restore HEAD versions of all staged files, load the app in a
   * fresh browser context, screenshot it (the "before" state), then restore
   * the current staged versions.
   *
   * Returns true on success, false if capture failed or was skipped.
   */
  private async captureGitBaseline(
    browser: Browser,
    url: string,
    width: number,
    height: number,
    swaps: StagedFileSwap[],
    outputPath: string
  ): Promise<boolean> {
    try {
      await withHeadVersions(swaps, async () => {
        const context: BrowserContext = await browser.newContext({
          viewport: { width, height },
          deviceScaleFactor: 1,
        });
        const page: Page = await context.newPage();
        try {
          await page.addInitScript(() => {
            const css = `*, *::before, *::after {
              transition: none !important;
              animation: none !important;
            }`;
            const style = document.createElement('style');
            style.textContent = css;
            document.head
              ? document.head.appendChild(style)
              : document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
          });
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
          await page.waitForTimeout(500);
          await page.screenshot({ path: outputPath, fullPage: false });
        } finally {
          await context.close();
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}
