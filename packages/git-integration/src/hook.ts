import fs from 'node:fs';
import path from 'node:path';

export const HOOK_MARKER = '# PixelBreak Pre-Commit Hook';

export function getGitHooksDir(cwd: string = process.cwd()): string | null {
  const gitDir = path.join(cwd, '.git');
  if (!fs.existsSync(gitDir)) {
    return null;
  }
  const hooksDir = path.join(gitDir, 'hooks');
  return hooksDir;
}

export function generatePreCommitScript(): string {
  return `#!/bin/sh
${HOOK_MARKER}

# Emergency bypass
if [ "$PIXELBREAK_BYPASS" = "1" ]; then
  echo "⚠️  [PixelBreak] Pre-commit checks bypassed via PIXELBREAK_BYPASS=1"
  exit 0
fi

echo "🔍 [PixelBreak] Running pre-commit checks..."

# Execute pixelbreak check
if [ -f "./apps/runner/dist/cli.js" ]; then
  node ./apps/runner/dist/cli.js check
elif command -v npx >/dev/null 2>&1; then
  npx pixelbreak check
else
  echo "❌ [PixelBreak] Could not locate runner CLI."
  exit 1
fi

SCAN_EXIT=$?
if [ $SCAN_EXIT -ne 0 ]; then
  echo ""
  echo "🚨 [PixelBreak] Commit blocked by severity policy!"
  echo "   Fix detected issues, or configure a scoped waiver in .pixelbreak-waivers.yml."
  echo "   Emergency bypass: PIXELBREAK_BYPASS=1 git commit"
  exit $SCAN_EXIT
fi

exit 0
`;
}

export function installPreCommitHook(cwd: string = process.cwd()): { success: boolean; hookPath?: string; message: string } {
  const hooksDir = getGitHooksDir(cwd);
  if (!hooksDir) {
    return {
      success: false,
      message: 'Not a git repository (could not locate .git directory).',
    };
  }

  fs.mkdirSync(hooksDir, { recursive: true });
  const hookPath = path.join(hooksDir, 'pre-commit');

  if (fs.existsSync(hookPath)) {
    const existingContent = fs.readFileSync(hookPath, 'utf-8');
    if (existingContent.includes(HOOK_MARKER)) {
      return {
        success: true,
        hookPath,
        message: 'PixelBreak pre-commit hook is already installed.',
      };
    }
  }

  const script = generatePreCommitScript();
  fs.writeFileSync(hookPath, script, { encoding: 'utf-8', mode: 0o755 });

  return {
    success: true,
    hookPath,
    message: `Installed pre-commit hook at ${hookPath}`,
  };
}

export function isPreCommitHookInstalled(cwd: string = process.cwd()): boolean {
  const hooksDir = getGitHooksDir(cwd);
  if (!hooksDir) return false;
  const hookPath = path.join(hooksDir, 'pre-commit');
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, 'utf-8');
  return content.includes(HOOK_MARKER);
}

export function removePreCommitHook(cwd: string = process.cwd()): boolean {
  const hooksDir = getGitHooksDir(cwd);
  if (!hooksDir) return false;
  const hookPath = path.join(hooksDir, 'pre-commit');
  if (!fs.existsSync(hookPath)) return false;
  const content = fs.readFileSync(hookPath, 'utf-8');
  if (content.includes(HOOK_MARKER)) {
    fs.unlinkSync(hookPath);
    return true;
  }
  return false;
}
