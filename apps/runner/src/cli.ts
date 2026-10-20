#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from './scanner.js';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program
  .name('pixelbreak')
  .description('Local-first responsive breakpoint detection and visual regression testing')
  .version('0.1.0');

program
  .command('check')
  .description('Run configured responsive breakpoint and layout checks')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .action(async (options) => {
    try {
      console.log('🔍 Loading PixelBreak configuration...');
      const config = loadConfig(options.config);

      console.log(`🚀 Starting scan for project '${config.project.name}'...`);
      console.log(`   Base URL: ${config.project.baseUrl}`);
      console.log(`   Profile:  ${config.viewports.profile}`);
      console.log(`   Widths:   [${config.viewports.widths.join(', ')}]px`);

      const scanner = new Scanner({ config });
      const result = await scanner.run();

      console.log('\n📊 Scan Complete:');
      console.log(`   Duration:  ${result.durationMs}ms`);
      console.log(`   Viewports: ${result.viewportsScanned.join(', ')}px`);
      console.log(`   Findings:  ${result.findings.length}`);

      if (result.findings.length === 0) {
        console.log('\n✅ All responsive checks passed! No layout issues detected.');
        process.exit(0);
      }

      console.log('\n⚠️  Issues detected:');
      let hasBlocking = false;

      for (const finding of result.findings) {
        const icon = finding.severity === 'critical' || finding.severity === 'high' ? '🚨' : '⚠️';
        console.log(`\n  ${icon} [${finding.severity.toUpperCase()}] ${finding.ruleId} @ ${finding.viewport.width}px (${finding.route})`);
        console.log(`     Summary:  ${finding.summary}`);
        if (finding.selector) {
          console.log(`     Element:  ${finding.selector}`);
        }
        if (finding.currentImage) {
          console.log(`     Evidence: ${finding.currentImage}`);
        }

        if (finding.severity === 'high' || finding.severity === 'critical') {
          hasBlocking = true;
        }
      }

      if (hasBlocking) {
        console.log('\n❌ Scan failed: High or critical severity layout regressions detected.');
        process.exit(1);
      } else {
        console.log('\n⚠️  Scan finished with moderate or low findings.');
        process.exit(0);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${message}`);
      process.exit(2);
    }
  });

program
  .command('init')
  .description('Initialize .pixelbreak.yml configuration and pre-commit hook')
  .action(() => {
    const targetPath = path.join(process.cwd(), '.pixelbreak.yml');
    if (fs.existsSync(targetPath)) {
      console.log('ℹ️  .pixelbreak.yml already exists.');
      return;
    }

    const template = `version: 1

project:
  name: my-app
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
    fs.writeFileSync(targetPath, template, 'utf-8');
    console.log('✅ Created .pixelbreak.yml template');
  });

program.parse(process.argv);
