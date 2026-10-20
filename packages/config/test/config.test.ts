import { describe, it, expect } from 'vitest';
import { parseConfig, ConfigError } from '../src/index.js';

describe('@pixelbreak/config', () => {
  const validDesktopYml = `
version: 1

project:
  name: my-desktop-app
  baseUrl: http://localhost:4173
  routes:
    - /

viewports:
  profile: desktop-only
  minWidth: 1024
  maxWidth: 1920
  widths: [1024, 1280, 1440, 1920]
  required: true

checks:
  responsive: true
  visualRegression: true
  failOnScannerError: true

severity:
  critical: block
  high: block
  moderate: require-waiver
  low: allow
  informational: allow

waivers:
  file: .pixelbreak-waivers.yml
  requireReason: true
  allowExpiry: true

ai:
  provider: local
  endpoint: http://localhost:8080
  requiredForExplanations: true
  requiredForFixSuggestions: true
`;

  it('successfully parses valid desktop-only configuration', () => {
    const config = parseConfig(validDesktopYml);
    expect(config.version).toBe(1);
    expect(config.project.name).toBe('my-desktop-app');
    expect(config.project.baseUrl).toBe('http://localhost:4173');
    expect(config.viewports.profile).toBe('desktop-only');
    expect(config.viewports.widths).toEqual([1024, 1280, 1440, 1920]);
    expect(config.severity.critical).toBe('block');
    expect(config.ai.provider).toBe('local');
  });

  it('rejects widths outside of [minWidth, maxWidth]', () => {
    const invalidWidthsYml = validDesktopYml.replace(
      'widths: [1024, 1280, 1440, 1920]',
      'widths: [375, 1024, 1920]' // 375 is below minWidth 1024
    );

    expect(() => parseConfig(invalidWidthsYml)).toThrow(ConfigError);
    expect(() => parseConfig(invalidWidthsYml)).toThrow(/within \[minWidth, maxWidth\]/);
  });

  it('rejects minWidth greater than maxWidth', () => {
    const invalidMinMax = validDesktopYml
      .replace('minWidth: 1024', 'minWidth: 2000')
      .replace('maxWidth: 1920', 'maxWidth: 1024')
      .replace('widths: [1024, 1280, 1440, 1920]', 'widths: [1200]');

    expect(() => parseConfig(invalidMinMax)).toThrow(ConfigError);
    expect(() => parseConfig(invalidMinMax)).toThrow(/maxWidth must be greater than or equal to minWidth/);
  });

  it('rejects non-local AI providers (strictly local for MVP)', () => {
    const invalidAiYml = validDesktopYml.replace('provider: local', 'provider: openai');
    expect(() => parseConfig(invalidAiYml)).toThrow(ConfigError);
  });

  it('rejects invalid baseUrl URL', () => {
    const invalidUrlYml = validDesktopYml.replace('baseUrl: http://localhost:4173', 'baseUrl: not-a-url');
    expect(() => parseConfig(invalidUrlYml)).toThrow(ConfigError);
  });

  it('applies defaults when optional fields are omitted', () => {
    const minimalYml = `
project:
  name: test-app
  baseUrl: http://localhost:3000
  routes:
    - /

viewports:
  profile: desktop-only
  minWidth: 1024
  maxWidth: 1920
  widths: [1024, 1920]
`;
    const config = parseConfig(minimalYml);
    expect(config.version).toBe(1);
    expect(config.checks.responsive).toBe(true);
    expect(config.checks.visualRegression).toBe(true);
    expect(config.severity.critical).toBe('block');
    expect(config.severity.moderate).toBe('require-waiver');
    expect(config.waivers.file).toBe('.pixelbreak-waivers.yml');
    expect(config.ai.provider).toBe('local');
    expect(config.ai.endpoint).toBe('http://localhost:8080');
  });
});
