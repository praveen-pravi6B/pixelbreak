import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { ZodError } from 'zod';
import { PixelBreakConfigSchema, type ValidatedConfig } from './schema.js';

export const CONFIG_FILE_NAMES = ['.pixelbreak.yml', '.pixelbreak.yaml'];

export class ConfigError extends Error {
  constructor(message: string, public readonly issues?: string[]) {
    super(message);
    this.name = 'ConfigError';
  }
}

export function formatZodError(error: ZodError): string[] {
  return error.issues.map((issue) => {
    const pathStr = issue.path.join('.');
    return `[${pathStr || 'root'}]: ${issue.message}`;
  });
}

export function parseConfig(yamlContent: string): ValidatedConfig {
  let parsedRaw: unknown;
  try {
    parsedRaw = YAML.parse(yamlContent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to parse YAML configuration: ${message}`);
  }

  if (typeof parsedRaw !== 'object' || parsedRaw === null) {
    throw new ConfigError('Invalid configuration: root must be a YAML mapping/object');
  }

  const result = PixelBreakConfigSchema.safeParse(parsedRaw);
  if (!result.success) {
    const issues = formatZodError(result.error);
    const summary = issues.join('\n  - ');
    throw new ConfigError(
      `Invalid .pixelbreak.yml configuration:\n  - ${summary}`,
      issues
    );
  }

  return result.data as ValidatedConfig;
}

export function findConfigFile(dir: string = process.cwd()): string | null {
  for (const name of CONFIG_FILE_NAMES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function loadConfig(filePath?: string): ValidatedConfig {
  // SECURITY: if a custom config path is provided, ensure it stays within
  // the project directory — prevents reading arbitrary files via --config /etc/passwd
  if (filePath) {
    const resolved = path.resolve(filePath);
    const cwd = path.resolve(process.cwd());
    if (!resolved.startsWith(cwd + path.sep) && resolved !== cwd) {
      throw new ConfigError(
        `Config file must be within the project directory.\n` +
        `  Given: ${filePath}\n` +
        `  Project root: ${cwd}`
      );
    }
  }

  const targetPath = filePath ?? findConfigFile();
  if (!targetPath || !fs.existsSync(targetPath)) {
    throw new ConfigError(
      `Configuration file not found. Expected one of: ${CONFIG_FILE_NAMES.join(', ')} in ${process.cwd()}`
    );
  }

  try {
    const content = fs.readFileSync(targetPath, 'utf-8');
    return parseConfig(content);
  } catch (err: unknown) {
    if (err instanceof ConfigError) {
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new ConfigError(`Failed to read configuration file at ${targetPath}: ${message}`);
  }
}
