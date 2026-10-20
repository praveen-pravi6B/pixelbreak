import fs from 'node:fs';
import path from 'node:path';

export function sanitizeRouteName(route: string): string {
  return route.replace(/\//g, '_').replace(/^_/, '') || 'root';
}

export function getBaselineFileName(route: string, width: number): string {
  const sanitized = sanitizeRouteName(route);
  return `${sanitized}_${width}px.png`;
}

export function getBaselinePath(baselineDir: string, route: string, width: number): string {
  return path.join(baselineDir, getBaselineFileName(route, width));
}

export function hasBaselines(baselineDir: string): boolean {
  if (!fs.existsSync(baselineDir)) {
    return false;
  }
  const files = fs.readdirSync(baselineDir);
  return files.some((f) => f.endsWith('.png'));
}

export function updateBaselinesFromScreenshots(
  screenshots: Record<string, string>, // key: `${route}-${width}` -> absolute path
  baselineDir: string
): { updatedFiles: string[] } {
  fs.mkdirSync(baselineDir, { recursive: true });
  const updatedFiles: string[] = [];

  for (const [key, sourcePath] of Object.entries(screenshots)) {
    if (!fs.existsSync(sourcePath)) {
      continue;
    }
    // key is formatted as `${route}-${width}`
    const lastHyphen = key.lastIndexOf('-');
    const route = key.slice(0, lastHyphen);
    const width = parseInt(key.slice(lastHyphen + 1), 10);

    const destPath = getBaselinePath(baselineDir, route, width);
    fs.copyFileSync(sourcePath, destPath);
    updatedFiles.push(destPath);
  }

  return { updatedFiles };
}
