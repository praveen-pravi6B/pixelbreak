import fs from 'node:fs';
import YAML from 'yaml';
import { z } from 'zod';
import type { Waiver } from '@pixelbreak/contracts';

// SECURITY: strict Zod schema — reject any extra keys or unexpected types.
// Prevents prototype pollution from malicious __proto__ keys in YAML.
const WaiverSchema = z.object({
  id: z.string(),
  findingId: z.string().optional(),
  ruleId: z.string().optional(),
  route: z.string().optional(),
  viewportWidth: z.number().optional(),
  maxSeverityAllowed: z
    .enum(['critical', 'high', 'moderate', 'low', 'informational'])
    .optional(),
  reason: z.string(),
  author: z.string().optional(),
  createdAt: z.string(),
  expiresAt: z.string().optional(),
}).strict(); // .strict() rejects unknown keys

const WaiversArraySchema = z.array(WaiverSchema);

const WaiversFileSchema = z.object({
  version: z.number(),
  waivers: WaiversArraySchema,
}).strict();

export function loadWaiversFile(filePath: string): Waiver[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to read waivers file at '${filePath}': ${msg}`);
  }

  let parsed: unknown;
  try {
    parsed = YAML.parse(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse waivers YAML at '${filePath}': ${msg}`);
  }

  if (!parsed) return [];

  // Try array format: [{id, reason, ...}, ...]
  if (Array.isArray(parsed)) {
    const result = WaiversArraySchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue: z.ZodIssue) => `  [${issue.path.join('.')}]: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid waivers file at '${filePath}':\n${issues}`);
    }
    return result.data as Waiver[];
  }

  // Try object format: {version: 1, waivers: [...]}
  if (typeof parsed === 'object' && parsed !== null) {
    const result = WaiversFileSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue: z.ZodIssue) => `  [${issue.path.join('.')}]: ${issue.message}`)
        .join('\n');
      throw new Error(`Invalid waivers file at '${filePath}':\n${issues}`);
    }
    return result.data.waivers as Waiver[];
  }

  throw new Error(
    `Invalid waivers file at '${filePath}': expected a YAML array or {version, waivers} object.`
  );
}

export function saveWaiversFile(filePath: string, waivers: Waiver[]): void {
  const content = YAML.stringify({
    version: 1,
    waivers,
  });
  fs.writeFileSync(filePath, content, 'utf-8');
}
