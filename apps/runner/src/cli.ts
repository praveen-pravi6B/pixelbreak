#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig } from '@pixelbreak/config';
import { Scanner } from './scanner.js';
import { updateBaselinesFromScreenshots } from '@pixelbreak/visual-diff';
import { loadWaiversFile, evaluatePolicy } from '@pixelbreak/policy-engine';
import { installPreCommitHook } from '@pixelbreak/git-integration';
import { LlamaCppAdapter, AiUnavailableError } from '@pixelbreak/ai-engine';
import type { AiExplanation } from '@pixelbreak/ai-engine';
import type { Finding, ScanReport } from '@pixelbreak/contracts';
import { saveReport } from './report-store.js';
import { startDashboardServer } from './dashboard-server.js';
import fs from 'node:fs';
import path from 'node:path';
import { exec } from 'node:child_process';

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

      // Save report to .pixelbreak/reports/
      const report: ScanReport = {
        scanId: result.scanId,
        toolVersion: scanner.toolVersion,
        timestamp: result.timestamp,
        config,
        policyResult,
        findings: result.findings,
        routesScanned: result.routesScanned,
        viewportsScanned: result.viewportsScanned,
        durationMs: result.durationMs,
      };
      const reportPath = saveReport(report, scanner.outputDir);
      const dashboardUrl = 'http://localhost:3847';
      console.log(`\n💾 Report saved: ${reportPath}`);

      // AI explanations for blocked findings (high/critical)
      const blockedFindings = policyResult.findings
        .filter(fe => fe.action === 'block' && !fe.waived)
        .map(fe => fe.finding);

      if (blockedFindings.length > 0 && config.ai.requiredForExplanations) {
        const aiAdapter = new LlamaCppAdapter(config.ai);
        const aiStatus = await aiAdapter.checkStatus();

        if (!aiStatus.available) {
          console.log('\n⚠️  Local AI Unavailable:');
          console.log(`   Endpoint: ${aiStatus.endpoint}`);
          console.log(`   Reason:   ${aiStatus.error}`);
          console.log('   AI explanations and patch suggestions are unavailable.');
          console.log('   Start llama.cpp to enable: llama-server --model <model.gguf> --port 8080');
        } else {
          console.log(`\n🤖 Local AI (${aiStatus.model ?? 'unknown model'}) — Analysing blocked findings...`);
          console.log('   (Explanations are hypotheses — not independently verified)');
          const explanations = await fetchAiExplanations(aiAdapter, blockedFindings);
          printAiExplanations(explanations);
        }
      }

      if (policyResult.decision === 'block') {
        console.log('\n❌ Commit Gate: BLOCKED by PixelBreak policy.');
        console.log(`   Dashboard: ${dashboardUrl}  (run: pixelbreak dashboard)`);
        console.log('   To resolve: fix the detected regressions, or add a scoped waiver for moderate issues.');
        console.log('   Emergency bypass: PIXELBREAK_BYPASS=1 git commit');
        process.exit(1);
      } else {
        console.log('\n✅ Commit Gate: PASSED. All findings satisfied policy criteria.');
        if (policyResult.waivedCount > 0 || result.findings.length > 0) {
          console.log(`   Dashboard: ${dashboardUrl}  (run: pixelbreak dashboard)`);
        }
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

program
  .command('dashboard')
  .description('Start the localhost report dashboard and open it in the browser')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const outputDir = path.join(process.cwd(), '.pixelbreak');
      console.log('🚀 Starting PixelBreak dashboard...');
      const { url } = await startDashboardServer(outputDir);
      console.log(`\n✅ Dashboard running at: ${url}`);
      console.log(`   Project: ${config.project.name}`);
      console.log('   Press Ctrl+C to stop.\n');
      openBrowser(url);
      // Keep process alive
      await new Promise(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Dashboard error: ${message}`);
      process.exit(2);
    }
  });

program
  .command('review')
  .description('Open the latest scan report in the localhost dashboard')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .action(async (options) => {
    try {
      loadConfig(options.config);
      const outputDir = path.join(process.cwd(), '.pixelbreak');
      const latestPath = path.join(outputDir, 'reports', 'latest.json');
      if (!fs.existsSync(latestPath)) {
        console.error('\n❌ No report found. Run pixelbreak check first.');
        process.exit(1);
      }
      console.log('🚀 Starting PixelBreak dashboard...');
      const { url } = await startDashboardServer(outputDir);
      console.log(`\n✅ Dashboard at: ${url}`);
      console.log('   Press Ctrl+C to stop.\n');
      openBrowser(url);
      await new Promise(() => {});
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${message}`);
      process.exit(2);
    }
  });

const aiCmd = program.command('ai').description('Local AI engine management');

aiCmd
  .command('status')
  .description('Check connectivity to the local llama.cpp endpoint')
  .option('-c, --config <path>', 'Path to .pixelbreak.yml configuration file')
  .action(async (options) => {
    try {
      const config = loadConfig(options.config);
      const adapter = new LlamaCppAdapter(config.ai);
      console.log(`🤖 Checking local AI endpoint: ${config.ai.endpoint ?? 'http://localhost:8080'}`);
      const status = await adapter.checkStatus();

      if (status.available) {
        console.log(`\n✅ Local AI is available`);
        if (status.model) console.log(`   Model:   ${status.model}`);
        if (status.latencyMs !== undefined) console.log(`   Latency: ${status.latencyMs}ms`);
      } else {
        console.log(`\n❌ Local AI is unavailable`);
        console.log(`   Endpoint: ${status.endpoint}`);
        console.log(`   Reason:   ${status.error}`);
        console.log('\n   To start llama.cpp:');
        console.log('   llama-server --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf --port 8080');
        process.exit(1);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n❌ Error: ${message}`);
      process.exit(2);
    }
  });

program.parse(process.argv);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function openBrowser(url: string): void {
  const cmd = process.platform === 'darwin'
    ? `open "${url}"`
    : process.platform === 'win32'
    ? `start "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, err => {
    if (err) console.log(`   Could not open browser automatically. Visit: ${url}`);
  });
}

async function fetchAiExplanations(
  adapter: LlamaCppAdapter,
  findings: Finding[]
): Promise<AiExplanation[]> {
  const results: AiExplanation[] = [];
  for (const finding of findings) {
    try {
      const explanation = await adapter.explainFinding({ finding });
      results.push(explanation);
    } catch (err) {
      if (err instanceof AiUnavailableError) {
        console.log(`\n  ⚠️  AI unavailable for finding ${finding.id}: ${err.message.split('\n')[0]}`);
        break;
      }
      console.log(`\n  ⚠️  AI analysis failed for ${finding.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return results;
}

function printAiExplanations(explanations: AiExplanation[]): void {
  if (explanations.length === 0) return;

  console.log('\n🧠 AI Analysis (hypothesis — not independently verified):');
  for (const ex of explanations) {
    console.log(`\n  Finding: ${ex.findingId} [${ex.severity.toUpperCase()}]`);
    console.log(`  Summary: ${ex.summary}`);
    console.log(`  Likely Cause: ${ex.likelyCause}`);
    if (ex.supportingEvidence.length > 0) {
      console.log('  Evidence:');
      for (const ev of ex.supportingEvidence) {
        console.log(`    • ${ev}`);
      }
    }
    if (ex.patch) {
      console.log('\n  💡 Patch Proposal (PREVIEW — requires explicit approval):');
      console.log(`     Selector:  ${ex.patch.cssSelector}`);
      console.log(`     Property:  ${ex.patch.property}: ${ex.patch.proposedValue}`);
      console.log(`     Why:       ${ex.patch.explanation}`);
      console.log(`     Expected:  ${ex.patch.expectedEffect}`);
      console.log('     Run `pixelbreak review` to view and approve patches in the dashboard.');
    } else {
      console.log(`  Patch: None suggested — ${ex.limitations}`);
    }
  }
}
