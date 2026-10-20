import { execSync } from 'node:child_process';

export function getStagedFiles(cwd: string = process.cwd()): string[] {
  try {
    const stdout = execSync('git diff --name-only --cached', {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return stdout
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  } catch {
    return [];
  }
}

export function hasStagedChanges(cwd: string = process.cwd()): boolean {
  return getStagedFiles(cwd).length > 0;
}
