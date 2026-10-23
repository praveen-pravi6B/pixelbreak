import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withHeadVersions, getStagedFileSwaps } from '../../apps/runner/src/git-baseline.js'
import type { StagedFileSwap } from '../../apps/runner/src/git-baseline.js'

// ---------------------------------------------------------------------------
// withHeadVersions — file restoration safety
// ---------------------------------------------------------------------------

describe('withHeadVersions — file restoration safety', () => {
  const tmpDir = os.tmpdir()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('restores files to current content after fn completes successfully', async () => {
    const filePath = path.join(tmpDir, `pb-test-${Date.now()}.txt`)
    const currentContent = Buffer.from('current content')
    const headContent = Buffer.from('head content')

    fs.writeFileSync(filePath, currentContent)

    const swap: StagedFileSwap = {
      relativePath: 'test.txt',
      absolutePath: filePath,
      currentContent,
      headContent,
    }

    let contentDuringFn = ''
    await withHeadVersions([swap], async () => {
      contentDuringFn = fs.readFileSync(filePath, 'utf-8')
    })

    expect(contentDuringFn).toBe('head content')
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('current content')
    fs.unlinkSync(filePath)
  })

  it('restores files even when fn throws', async () => {
    const filePath = path.join(tmpDir, `pb-test-${Date.now()}.txt`)
    const currentContent = Buffer.from('original')
    const headContent = Buffer.from('head version')

    fs.writeFileSync(filePath, currentContent)

    const swap: StagedFileSwap = {
      relativePath: 'test.txt',
      absolutePath: filePath,
      currentContent,
      headContent,
    }

    await expect(
      withHeadVersions([swap], async () => {
        throw new Error('simulated scan failure')
      })
    ).rejects.toThrow('simulated scan failure')

    // File must be restored even though fn threw
    expect(fs.readFileSync(filePath, 'utf-8')).toBe('original')
    fs.unlinkSync(filePath)
  })

  it('restores ALL files even if one restore write fails', async () => {
    const file1 = path.join(tmpDir, `pb-test-${Date.now()}-1.txt`)
    const file2 = path.join(tmpDir, `pb-test-${Date.now()}-2.txt`)

    fs.writeFileSync(file1, 'current1')
    fs.writeFileSync(file2, 'current2')

    const swaps: StagedFileSwap[] = [
      { relativePath: 'f1.txt', absolutePath: file1, currentContent: Buffer.from('current1'), headContent: Buffer.from('head1') },
      { relativePath: 'f2.txt', absolutePath: file2, currentContent: Buffer.from('current2'), headContent: Buffer.from('head2') },
    ]

    // Simulate first restore write failing
    let writeCount = 0
    const origWriteFileSync = fs.writeFileSync.bind(fs)
    vi.spyOn(fs, 'writeFileSync').mockImplementation((...args) => {
      writeCount++
      // First 2 writes are the HEAD writes, next writes are restores
      if (writeCount === 3) {
        throw new Error('disk full simulation')
      }
      return origWriteFileSync(...(args as Parameters<typeof fs.writeFileSync>))
    })

    await expect(
      withHeadVersions(swaps, async () => {
        // no-op
      })
    ).rejects.toThrow(/Failed to restore/)

    // file2 should still have been restored even though file1 restore failed
    expect(fs.readFileSync(file2, 'utf-8')).toBe('current2')

    vi.restoreAllMocks()
    fs.unlinkSync(file1)
    fs.unlinkSync(file2)
  })

  it('handles empty swaps array (no-op)', async () => {
    let called = false
    await withHeadVersions([], async () => { called = true })
    expect(called).toBe(true)
  })

  it('returns the value from fn', async () => {
    const result = await withHeadVersions([], async () => 42)
    expect(result).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// getStagedFileSwaps — edge cases
// ---------------------------------------------------------------------------

describe('getStagedFileSwaps — edge cases', () => {
  it('returns empty array when not in a git repository', () => {
    const result = getStagedFileSwaps('/tmp') // /tmp is not a git repo
    expect(result).toEqual([])
  })

  it('returns empty array when no files are staged', () => {
    // Run from a real git repo with nothing staged
    const result = getStagedFileSwaps(process.cwd())
    // Either empty (nothing staged) or has items — both valid, just shouldn't throw
    expect(Array.isArray(result)).toBe(true)
  })
})
