import { z } from 'zod';
import type { PixelBreakConfig } from '@pixelbreak/contracts';

export const ViewportProfileSchema = z.enum([
  'desktop-only',
  'mobile-only',
  'responsive',
  'custom',
]);

export const ViewportsConfigSchema = z
  .object({
    profile: ViewportProfileSchema,
    minWidth: z.number().int().positive(),
    maxWidth: z.number().int().positive(),
    widths: z.array(z.number().int().positive()).min(1),
    height: z.number().int().positive().default(900),
    required: z.boolean().default(true),
  })
  .refine((data) => data.maxWidth >= data.minWidth, {
    message: 'maxWidth must be greater than or equal to minWidth',
    path: ['maxWidth'],
  })
  .refine(
    (data) =>
      data.widths.every((w) => w >= data.minWidth && w <= data.maxWidth),
    {
      message: 'All configured widths must be within [minWidth, maxWidth]',
      path: ['widths'],
    }
  );

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  routes: z.array(z.string().min(1)).min(1),
});

export const ChecksConfigSchema = z.object({
  responsive: z.boolean().default(true),
  visualRegression: z.boolean().default(true),
  failOnScannerError: z.boolean().default(true),
});

export const SeverityActionSchema = z.enum(['block', 'require-waiver', 'allow']);

export const SeverityPolicyConfigSchema = z.object({
  critical: SeverityActionSchema.default('block'),
  high: SeverityActionSchema.default('block'),
  moderate: SeverityActionSchema.default('require-waiver'),
  low: SeverityActionSchema.default('allow'),
  informational: SeverityActionSchema.default('allow'),
});

export const WaiversConfigSchema = z.object({
  file: z.string().min(1).default('.pixelbreak-waivers.yml'),
  requireReason: z.boolean().default(true),
  allowExpiry: z.boolean().default(true),
});

export const AIConfigSchema = z.object({
  provider: z.literal('local').default('local'),
  endpoint: z.string().url().default('http://localhost:8080'),
  model: z.string().optional(),
  requiredForExplanations: z.boolean().default(true),
  requiredForFixSuggestions: z.boolean().default(true),
});

export const PixelBreakConfigSchema = z.object({
  version: z.literal(1).default(1),
  project: ProjectConfigSchema,
  viewports: ViewportsConfigSchema,
  checks: ChecksConfigSchema.default({
    responsive: true,
    visualRegression: true,
    failOnScannerError: true,
  }),
  severity: SeverityPolicyConfigSchema.default({
    critical: 'block',
    high: 'block',
    moderate: 'require-waiver',
    low: 'allow',
    informational: 'allow',
  }),
  waivers: WaiversConfigSchema.default({
    file: '.pixelbreak-waivers.yml',
    requireReason: true,
    allowExpiry: true,
  }),
  ai: AIConfigSchema.default({
    provider: 'local',
    endpoint: 'http://localhost:8080',
    requiredForExplanations: true,
    requiredForFixSuggestions: true,
  }),
});

export type ValidatedConfig = z.infer<typeof PixelBreakConfigSchema> & PixelBreakConfig;
