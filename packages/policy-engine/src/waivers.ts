import fs from 'node:fs';
import YAML from 'yaml';
import type { Waiver, WaiversFile } from '@pixelbreak/contracts';

export function loadWaiversFile(filePath: string): Waiver[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = YAML.parse(content) as WaiversFile | Waiver[] | null;

    if (!parsed) {
      return [];
    }

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (typeof parsed === 'object' && Array.isArray((parsed as WaiversFile).waivers)) {
      return (parsed as WaiversFile).waivers;
    }

    return [];
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse waivers file at '${filePath}': ${msg}`);
  }
}

export function saveWaiversFile(filePath: string, waivers: Waiver[]): void {
  const content = YAML.stringify({
    version: 1,
    waivers,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}
