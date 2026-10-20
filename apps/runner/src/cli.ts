#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from './scanner.js';
import { updateBaselinesFromScreenshots } from '@pixelbreak/visual-diff';
import { loadWaiversFile, evaluatePolicy } from '@pixelbreak/policy-engine';
import { installPreCommitHook } from '@pixelbreak/git-integration';
import fs from 'node:fs';
import path from 'node:path';

const program = new Command();

program
  .name('pixelbreak')
  .description('Local-first responsive breakpoint detection and visual regression testing')
  .version('0.1.0');

program
  .command('check')
  .description('Run configured responsive breakpoint and visual regression checks with severity policy gate')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .option('-w, --waivers <path>', 'Path to .pixelbreak-waivers.yml waivers file')
  .action(async (options) => {
    try {
      console.log('🔍 Loading PixelBreak configuration...');
      const config = loadConfig(options.config);

      const waiversPath = options.waivers ?? path.resolve(process.cwd(), config.waivers.file);
      const waivers = loadWaiversFile(waiversPath);

      console.log(`🚀 Starting scan for project '${config.project.name}'...`);
      console.log(`   Base URL: ${config.project.baseUrl}`);
      console.log(`   Profile:  ${config.viewports.profile}`);
      console.log(`   Widths:   [${config.viewports.widths.join(', ')}]px`);
      if (waivers.length > 0) {
        console.log(`   Waivers:  Loaded ${waivers.length} active waiver rule(s) from ${path.basename(waiversPath)}`);
      }

      const scanner = new Scanner({ config });
      const result = await scanner.run();

      console.log('\n📊 Scan Complete:');
      console.log(`   Duration:  ${result.durationMs}ms`);
      console.log(`   Viewports: ${result.viewportsScanned.join(', ')}px`);
      console.log(`   Findings:  ${result.findings.length}`);
      if (!result.hasBaselines && config.checks.visualRegression) {
        console.log('   ℹ️  No baselines found. Run `pixelbreak baseline update` to create them.');
      }

      // Evaluate Findings against Policy Engine and Waivers
      const policyResult = evaluatePolicy({
        findings: result.findings,
        config,
        waivers,
        scanId: result.scanId,
      });

      console.log('\n⚖️  Policy Engine Decision:');
      console.log(`   Status:   ${policyResult.decision.toUpperCase()}`);
      console.log(`   Blocked:  ${policyResult.blockedCount}`);
      console.log(`   Waived:   ${policyResult.waivedCount}`);
      console.log(`   Allowed:  ${policyResult.allowedCount}`);

      if (policyResult.findings.length > 0) {
        console.log('\n📋 Evaluated Findings:');
        for (const fe of policyResult.findings) {
          const finding = fe.finding;
          let statusLabel = '🚨 BLOCKED';
          if (fe.waived) {
            statusLabel = `🛡️  WAIVED (Waiver: ${fe.waiverId})`;
          } else if (fe.action === 'allow') {
            statusLabel = 'ℹ️  ALLOWED';
          }

          console.log(`\n  ${statusLabel} [${finding.severity.toUpperCase()}] ${finding.ruleId} @ ${finding.viewport.width}px (${finding.route})`);
          console.log(`     Summary:  ${finding.summary}`);
          if (finding.selector) {
            console.log(`     Element:  ${finding.selector}`);
          }
          if (fe.reasons.length > 0) {
            console.log(`     Policy:   ${fe.reasons.join(' ')}`);
          }
        }
      }

      if (policyResult.decision === 'block') {
        console.log('\n❌ Commit Gate: BLOCKED by PixelBreak policy.');
        console.log('   To resolve: fix the detected regressions, or add a scoped waiver for moderate issues.');
        console.log('   Emergency bypass: PIXELBREAK_BYPASS=1 git commit');
        process.exit(1);
      } else {
        console.log('\n✅ Commit Gate: PASSED. All findings satisfied policy criteria.');
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
  .description('Initialize .pixelbreak.yml configuration and pre-commit Git hook')
  .action(() => {
    const targetPath = path.join(process.cwd(), '.pixelbreak.yml');
    if (!fs.existsSync(targetPath)) {
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
    } else {
      console.log('ℹ️  .pixelbreak.yml already exists.');
    }

    // Install pre-commit hook
    const hookResult = installPreCommitHook();
    if (hookResult.success) {
      console.log(`✅ ${hookResult.message}`);
    } else {
      console.log(`⚠️  ${hookResult.message}`);
    }
  });

program.parse(process.argv);
