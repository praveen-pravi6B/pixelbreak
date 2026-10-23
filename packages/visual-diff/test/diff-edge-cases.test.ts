import { describe, it, expect } from 'vitest'
import { PNG } from 'pngjs'
import { compareImages } from '../src/diff.js'

// Helper: create a solid-color PNG buffer
function makePng(width: number, height: number, r = 0, g = 0, b = 0): Buffer {
  const png = new PNG({ width, height })
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = r
    png.data[i + 1] = g
    png.data[i + 2] = b
    png.data[i + 3] = 255
  }
  return PNG.sync.write(png)
}

describe('compareImages — edge cases and bounds safety', () => {
  it('returns 0 diff for identical images', () => {
    const img = makePng(100, 100, 255, 0, 0)
    const result = compareImages(img, img)
    expect(result.diffPixels).toBe(0)
    expect(result.diffPercentage).toBe(0)
  })

  it('detects 100% change between fully different images', () => {
    const red = makePng(100, 100, 255, 0, 0)
    const blue = makePng(100, 100, 0, 0, 255)
    const result = compareImages(red, blue)
    expect(result.diffPixels).toBeGreaterThan(0)
    expect(result.diffPercentage).toBeGreaterThan(0)
  })

  it('handles mismatched dimensions — smaller vs larger — without crashing', () => {
    const small = makePng(100, 100, 255, 0, 0)
    const large = makePng(200, 200, 0, 255, 0)
    expect(() => compareImages(small, large)).not.toThrow()
    const result = compareImages(small, large)
    expect(result.width).toBe(200)
    expect(result.height).toBe(200)
  })

  it('handles mismatched dimensions — taller vs wider — without crashing', () => {
    const tall = makePng(100, 500, 128, 128, 0)
    const wide = makePng(500, 100, 0, 128, 128)
    expect(() => compareImages(tall, wide)).not.toThrow()
    const result = compareImages(tall, wide)
    expect(result.width).toBe(500)
    expect(result.height).toBe(500)
  })

  it('returns valid PNG buffer for diff image', () => {
    const red = makePng(50, 50, 255, 0, 0)
    const blue = makePng(50, 50, 0, 0, 255)
    const result = compareImages(red, blue)
    expect(result.diffImageBuffer).toBeInstanceOf(Buffer)
    expect(result.diffImageBuffer.length).toBeGreaterThan(0)
    // Must be a parseable PNG
    expect(() => PNG.sync.read(result.diffImageBuffer)).not.toThrow()
  })

  it('handles 1×1 images — bounds guard prevents out-of-range access', () => {
    const a = makePng(1, 1, 255, 0, 0)
    const b = makePng(1, 1, 0, 255, 0)
    expect(() => compareImages(a, b)).not.toThrow()
    const result = compareImages(a, b)
    expect(result.totalPixels).toBe(1)
  })

  it('handles large images (800×600) without out-of-bounds crash', () => {
    const a = makePng(800, 600, 100, 100, 100)
    const b = makePng(800, 600, 200, 200, 200)
    expect(() => compareImages(a, b)).not.toThrow()
    const result = compareImages(a, b)
    expect(result.totalPixels).toBe(800 * 600)
  })

  it('returns changedBounds when pixels differ', () => {
    const red = makePng(100, 100, 255, 0, 0)
    const blue = makePng(100, 100, 0, 0, 255)
    const result = compareImages(red, blue)
    expect(result.changedBounds).toBeDefined()
    expect(result.changedBounds!.width).toBeGreaterThan(0)
    expect(result.changedBounds!.height).toBeGreaterThan(0)
  })

  it('returns no changedBounds for identical images', () => {
    const img = makePng(50, 50, 128, 64, 32)
    const result = compareImages(img, img)
    expect(result.changedBounds).toBeUndefined()
  })
})
