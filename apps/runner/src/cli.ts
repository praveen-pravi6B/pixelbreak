#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from './scanner.js';
import { updateBaselinesFromScreenshots } from '@pixelbreak/visual-diff';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program
  .name('pixelbreak')
  .description('Local-first responsive breakpoint detection and visual regression testing')
  .version('0.1.0');

program
  .command('check')
  .description('Run configured responsive breakpoint and visual regression checks')
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
      if (!result.hasBaselines && config.checks.visualRegression) {
        console.log('   ℹ️  No baselines found. Run `pixelbreak baseline update` to create them.');
      }

      if (result.findings.length === 0) {
        console.log('\n✅ All responsive and visual checks passed! No issues detected.');
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
          console.log(`     Current:  ${finding.currentImage}`);
        }
        if (finding.diffImage) {
          console.log(`     Diff:     ${finding.diffImage}`);
        }

        if (finding.severity === 'high' || finding.severity === 'critical') {
          hasBlocking = true;
        }
      }

      if (hasBlocking) {
        console.log('\n❌ Scan failed: High or critical severity regressions detected.');
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

const baselineCmd = program.command('baseline').description('Manage visual regression baselines');

baselineCmd
  .command('update')
  .description('Explicitly capture and approve baseline screenshots from the current application')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .action(async (options) => {
    try {
      console.log('🔍 Loading PixelBreak configuration...');
      const config = loadConfig(options.config);

      console.log(`📸 Capturing fresh screenshots for project '${config.project.name}'...`);
      const scanner = new Scanner({
        config,
        scanId: `baseline-${Date.now()}`,
      });
      const result = await scanner.run();

      const { updatedFiles } = updateBaselinesFromScreenshots(
        result.screenshots,
        scanner.baselineDir
      );

      console.log(`\n✅ Successfully updated ${updatedFiles.length} baseline(s):`);
      for (const file of updatedFiles) {
        console.log(`   - ${file}`);
      }
      console.log('\nBaselines have been explicitly approved.');
      process.exit(0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error updating baselines: ${message}`);
      process.exit(2);
    }
  });

program
  .command('init')
  .description('Initialize .pixelbreak.yml configuration')
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
