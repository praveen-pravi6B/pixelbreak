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
  durationMs: number;
}

export class Scanner {
  private config: PixelBreakConfig;
  private scanId: string;
  private outputDir: string;
  private toolVersion: string;

  constructor(options: ScannerOptions) {
    this.config = options.config;
    this.scanId = options.scanId ?? `scan-${Date.now()}`;
    this.outputDir = options.outputDir ?? path.join(process.cwd(), '.pixelbreak');
    this.toolVersion = options.toolVersion ?? '0.1.0';
  }

  async run(): Promise<ScanResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const screenshots: Record<string, string> = {};

    const screenshotsDir = path.join(this.outputDir, 'artifacts', 'screenshots', this.scanId);
    fs.mkdirSync(screenshotsDir, { recursive: true });

    // Enforce configured viewport profile constraints
    // Rule: Desktop-only applications must not be tested at mobile widths unless configured.
    // Only configured, supported widths are in scope.
    const widthsToTest = this.config.viewports.widths.filter((w) => {
      return w >= this.config.viewports.minWidth && w <= this.config.viewports.maxWidth;
    });

    const browser: Browser = await chromium.launch({
      headless: true,
    });

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

            // Navigate and wait for predictable ready condition
            await page.goto(fullUrl, {
              waitUntil: 'domcontentloaded',
              timeout: 15000,
            });

            // Brief wait for any initial layout settling
            await page.waitForTimeout(300);

            // Screenshot capture
            const sanitizedRoute = route.replace(/\//g, '_').replace(/^_/, '') || 'root';
            const screenshotFileName = `${sanitizedRoute}_${width}px.png`;
            const screenshotPath = path.join(screenshotsDir, screenshotFileName);

            await page.screenshot({
              path: screenshotPath,
              fullPage: false, // Match configured viewport dimensions
            });

            const screenshotKey = `${route}-${width}`;
            screenshots[screenshotKey] = screenshotPath;

            // 1. Run deterministic Horizontal Overflow Detection
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
          } finally {
            await context.close();
          }
        }
      }
    } finally {
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
      durationMs,
    };
  }
}
