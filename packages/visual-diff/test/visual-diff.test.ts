import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { compareImages, createVisualDiffFinding } from '../src/diff.js';

function createSolidPng(width: number, height: number, r: number, g: number, b: number): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

function createPngWithBox(
  width: number,
  height: number,
  box: { x: number; y: number; w: number; h: number }
): Buffer {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (width * y + x) * 4;
      const inBox =
        x >= box.x && x < box.x + box.w && y >= box.y && y < box.y + box.h;
      png.data[idx] = inBox ? 255 : 255;
      png.data[idx + 1] = inBox ? 0 : 255;
      png.data[idx + 2] = inBox ? 0 : 255;
      png.data[idx + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

describe('@pixelbreak/visual-diff', () => {
  it('returns 0 diff for identical images', () => {
    const img1 = createSolidPng(100, 100, 255, 255, 255);
    const img2 = createSolidPng(100, 100, 255, 255, 255);

    const result = compareImages(img1, img2);
    expect(result.diffPixels).toBe(0);
    expect(result.diffPercentage).toBe(0);
    expect(result.changedBounds).toBeUndefined();
  });

  it('accurately identifies changed pixels and bounding box for differing images', () => {
    const base = createSolidPng(100, 100, 255, 255, 255);
    const modified = createPngWithBox(100, 100, { x: 30, y: 40, w: 20, h: 25 });

    const result = compareImages(base, modified);
    expect(result.diffPixels).toBe(20 * 25);
    expect(result.diffPercentage).toBe(5); // 500 / 10000 = 5%
    expect(result.changedBounds).toBeDefined();
    expect(result.changedBounds?.minX).toBe(30);
    expect(result.changedBounds?.minY).toBe(40);
    expect(result.changedBounds?.width).toBe(20);
    expect(result.changedBounds?.height).toBe(25);
  });

  it('creates visual diff finding when diff exceeds threshold', () => {
    const base = createSolidPng(100, 100, 255, 255, 255);
    const modified = createPngWithBox(100, 100, { x: 10, y: 10, w: 20, h: 20 });
    const diff = compareImages(base, modified);

    const finding = createVisualDiffFinding(diff, {
      scanId: 'scan-visual-1',
      toolVersion: '0.1.0',
      route: '/',
      viewport: { width: 1024, height: 900 },
      baselineImagePath: '/path/to/baseline.png',
      currentImagePath: '/path/to/current.png',
      diffImagePath: '/path/to/diff.png',
    });

    expect(finding).not.toBeNull();
    expect(finding?.category).toBe('visual-regression');
    expect(finding?.ruleId).toBe('visual-regression');
    expect(finding?.severity).toBe('high');
    expect(finding?.evidence.diffPercentage).toBe(4);
    expect(finding?.baselineImage).toBe('/path/to/baseline.png');
    expect(finding?.diffImage).toBe('/path/to/diff.png');
  });

  it('returns null finding when diff is below tolerance threshold', () => {
    const base = createSolidPng(1000, 1000, 255, 255, 255);
    // 2 pixels out of 1,000,000 = 0.0002%
    const modified = createPngWithBox(1000, 1000, { x: 10, y: 10, w: 1, h: 2 });
    const diff = compareImages(base, modified);

    const finding = createVisualDiffFinding(diff, {
      scanId: 'scan-visual-2',
      toolVersion: '0.1.0',
      route: '/',
      viewport: { width: 1024, height: 900 },
      baselineImagePath: '/path/to/baseline.png',
      currentImagePath: '/path/to/current.png',
      diffImagePath: '/path/to/diff.png',
      toleranceThresholdPercentage: 0.01,
    });

    expect(finding).toBeNull();
  });
});
