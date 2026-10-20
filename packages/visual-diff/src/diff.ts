import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Finding, FindingEvidence, ViewportDimensions } from '@pixelbreak/contracts';

export interface ChangedBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface DiffResult {
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  diffImageBuffer: Buffer;
  changedBounds?: ChangedBounds;
  width: number;
  height: number;
}

export interface CompareOptions {
  threshold?: number; // pixelmatch color delta threshold (0 to 1, default 0.1)
  includeAA?: boolean;
}

export function compareImages(
  baselinePngBuffer: Buffer,
  currentPngBuffer: Buffer,
  options: CompareOptions = {}
): DiffResult {
  const baseline = PNG.sync.read(baselinePngBuffer);
  const current = PNG.sync.read(currentPngBuffer);

  const width = Math.max(baseline.width, current.width);
  const height = Math.max(baseline.height, current.height);

  // Normalize images to identical canvas dimensions if needed
  let normalizedBaseline: PNG = baseline;
  if (baseline.width !== width || baseline.height !== height) {
    normalizedBaseline = new PNG({ width, height });
    PNG.bitblt(baseline, normalizedBaseline, 0, 0, baseline.width, baseline.height, 0, 0);
  }

  let normalizedCurrent: PNG = current;
  if (current.width !== width || current.height !== height) {
    normalizedCurrent = new PNG({ width, height });
    PNG.bitblt(current, normalizedCurrent, 0, 0, current.width, current.height, 0, 0);
  }

  const diffPng = new PNG({ width, height });

  const diffPixels = pixelmatch(
    normalizedBaseline.data,
    normalizedCurrent.data,
    diffPng.data,
    width,
    height,
    {
      threshold: options.threshold ?? 0.1,
      includeAA: options.includeAA ?? false,
    }
  );

  const totalPixels = width * height;
  const diffPercentage = totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0;

  let changedBounds: ChangedBounds | undefined;

  if (diffPixels > 0) {
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    // Scan diff pixels to find exact changed bounding box
    // Pixelmatch marks diff pixels with [255, 0, 0] by default
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) * 4;
        const r = diffPng.data[idx];
        const g = diffPng.data[idx + 1];
        const b = diffPng.data[idx + 2];
        const a = diffPng.data[idx + 3];

        const isDiff = a > 0 && r === 255 && g === 0 && b === 0;
        if (isDiff) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX >= minX && maxY >= minY) {
      changedBounds = {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      };
    }
  }

  const diffImageBuffer = PNG.sync.write(diffPng);

  return {
    diffPixels,
    totalPixels,
    diffPercentage,
    diffImageBuffer,
    changedBounds,
    width,
    height,
  };
}

export function createVisualDiffFinding(
  diff: DiffResult,
  options: {
    scanId: string;
    toolVersion: string;
    route: string;
    viewport: ViewportDimensions;
    baselineImagePath: string;
    currentImagePath: string;
    diffImagePath: string;
    toleranceThresholdPercentage?: number;
  }
): Finding | null {
  const tolerance = options.toleranceThresholdPercentage ?? 0.05; // 0.05% tolerance

  if (diff.diffPercentage <= tolerance) {
    return null; // Passed within configured threshold
  }

  // Major regression > 2% is high severity; noticeable 0.05% - 2% is moderate
  const severity = diff.diffPercentage >= 2.0 ? 'high' : 'moderate';

  const evidence: FindingEvidence = {
    description: `Visual regression: ${diff.diffPercentage.toFixed(2)}% pixel difference (${diff.diffPixels} of ${diff.totalPixels} pixels).`,
    diffPercentage: Number(diff.diffPercentage.toFixed(3)),
    diffPixels: diff.diffPixels,
    viewportGeometry: options.viewport,
    measuredGeometry: diff.changedBounds
      ? {
          x: diff.changedBounds.minX,
          y: diff.changedBounds.minY,
          width: diff.changedBounds.width,
          height: diff.changedBounds.height,
        }
      : undefined,
  };

  return {
    id: `finding-${options.scanId}-${options.viewport.width}-visual-diff`,
    scanId: options.scanId,
    toolVersion: options.toolVersion,
    timestamp: new Date().toISOString(),
    ruleId: 'visual-regression',
    severity,
    category: 'visual-regression',
    route: options.route,
    viewport: options.viewport,
    summary: `Visual regression detected: ${diff.diffPercentage.toFixed(2)}% pixel diff (${diff.diffPixels} pixels changed) at ${options.viewport.width}px.`,
    evidence,
    baselineImage: options.baselineImagePath,
    currentImage: options.currentImagePath,
    diffImage: options.diffImagePath,
    status: 'open',
  };
}
