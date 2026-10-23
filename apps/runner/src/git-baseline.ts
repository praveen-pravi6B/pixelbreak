import { execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export interface StagedFileSwap {
  relativePath: string
  absolutePath: string
  /** Content of the file as it is right now (staged/working version) */
  currentContent: Buffer
  /** Content from the last commit (HEAD). null when the file is brand-new. */
  headContent: Buffer | null
}

// 50 MB per file cap — large binaries (video, zip) are skipped separately
const MAX_FILE_BYTES = 50 * 1024 * 1024

/**
 * Get every staged file that PixelBreak can use for a git-aware baseline.
 * For each file, fetches the HEAD version so we can temporarily restore it
 * to screenshot the "before" state.
 *
 * Security:
 * - Uses execFileSync (not execSync with string interpolation) to prevent
 *   command injection from file paths containing shell metacharacters.
 * - Skips symlinks — writeFileSync on a symlink target would corrupt the link.
 * - Skips files larger than 50 MB to avoid OOM in the baseline comparison.
 *
 * Returns an empty array when there are no staged changes or git is unavailable.
 */
export function getStagedFileSwaps(cwd: string): StagedFileSwap[] {
  let stagedOutput: string
  try {
    stagedOutput = execSync('git diff --cached --name-only', {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
      .toString()
      .trim()
  } catch {
    // Not a git repo or git is unavailable
    return []
  }

  if (!stagedOutput) return []

  const relativePaths = stagedOutput.split('\n').filter(Boolean)
  const swaps: StagedFileSwap[] = []

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(cwd, relativePath)

    // Skip deleted files (staged for removal)
    if (!fs.existsSync(absolutePath)) continue

    // SECURITY: skip symlinks — restoring their content would corrupt the link
    try {
      if (fs.lstatSync(absolutePath).isSymbolicLink()) continue
    } catch {
      continue
    }

    // Skip files larger than the cap — too big for in-memory baseline capture
    let stat: fs.Stats
    try {
      stat = fs.statSync(absolutePath)
    } catch {
      continue
    }
    if (stat.size > MAX_FILE_BYTES) continue

    let currentContent: Buffer
    try {
      currentContent = fs.readFileSync(absolutePath)
    } catch {
      continue
    }

    // SECURITY: use execFileSync with array arguments — prevents shell injection
    // from file paths containing metacharacters like ;, $(), backticks, etc.
    let headContent: Buffer | null = null
    try {
      headContent = execFileSync('git', ['show', `HEAD:${relativePath}`], {
        cwd,
        maxBuffer: MAX_FILE_BYTES,
      })
    } catch {
      // File is new in this commit — no previous version to compare against
      headContent = null
    }

    swaps.push({ relativePath, absolutePath, currentContent, headContent })
  }

  // Only return swaps that have a HEAD version — new files can't produce a baseline
  return swaps.filter(s => s.headContent !== null)
}

/**
 * Temporarily write HEAD versions of all staged files to disk, run `fn`,
 * then restore the current staged versions — always, even if `fn` throws or
 * if an individual restore write fails.
 *
 * SAFETY GUARANTEE: Every file in `swaps` will be restored to its current
 * content before this function returns, regardless of errors. If any restore
 * write fails, a detailed error is thrown listing the paths that need manual
 * recovery via `git checkout -- <file>`.
 */
export async function withHeadVersions<T>(
  swaps: StagedFileSwap[],
  fn: () => Promise<T>
): Promise<T> {
  // Write HEAD versions to disk (the "before" state)
  for (const swap of swaps) {
    fs.writeFileSync(swap.absolutePath, swap.headContent!)
  }

  let result: T
  let fnError: unknown = null

  try {
    result = await fn()
  } catch (err) {
    fnError = err
    // fall through to restoration — never skip the finally
    result = undefined as unknown as T
  }

  // CRITICAL: restore every file — catch each individually so one failure
  // doesn't leave other files in HEAD state
  const restorationFailures: string[] = []
  for (const swap of swaps) {
    try {
      fs.writeFileSync(swap.absolutePath, swap.currentContent)
    } catch {
      restorationFailures.push(swap.absolutePath)
    }
  }

  if (restorationFailures.length > 0) {
    const paths = restorationFailures.join('\n  ')
    const msg =
      `PixelBreak: Failed to restore ${restorationFailures.length} staged file(s) after baseline capture.\n` +
      `  Manually recover with: git checkout -- <file>\n` +
      `  Affected files:\n  ${paths}`
    console.error(`\n⚠️  CRITICAL RESTORE FAILURE:\n  ${msg}`)
    throw new Error(msg)
  }

  // Re-throw any error from fn() after files are safely restored
  if (fnError !== null) throw fnError

  return result
}
