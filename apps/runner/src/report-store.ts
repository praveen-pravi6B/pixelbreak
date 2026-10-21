import fs from 'node:fs'
import path from 'node:path'
import type { ScanReport } from '@pixelbreak/contracts'

/**
 * Persist a ScanReport to `.pixelbreak/reports/`.
 * Also writes a `latest.json` that the dashboard reads by default.
 */
export function saveReport(report: ScanReport, outputDir: string): string {
  const reportsDir = path.join(outputDir, 'reports')
  fs.mkdirSync(reportsDir, { recursive: true })

  const reportPath = path.join(reportsDir, `${report.scanId}.json`)
  const latestPath = path.join(reportsDir, 'latest.json')
  const json = JSON.stringify(report, null, 2)

  fs.writeFileSync(reportPath, json, 'utf-8')
  fs.writeFileSync(latestPath, json, 'utf-8')

  return reportPath
}

/** Load a specific report by scanId, or the latest report when scanId is 'latest'. */
export function loadReport(scanId: string, outputDir: string): ScanReport | null {
  const reportsDir = path.join(outputDir, 'reports')
  const reportPath = path.join(reportsDir, scanId === 'latest' ? 'latest.json' : `${scanId}.json`)

  if (!fs.existsSync(reportPath)) return null

  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf-8')) as ScanReport
  } catch {
    return null
  }
}

/** List all report IDs (scan IDs) in the reports directory, most recent first. */
export function listReports(outputDir: string): string[] {
  const reportsDir = path.join(outputDir, 'reports')
  if (!fs.existsSync(reportsDir)) return []

  return fs
    .readdirSync(reportsDir)
    .filter(f => f.endsWith('.json') && f !== 'latest.json')
    .map(f => f.replace('.json', ''))
    .sort()
    .reverse()
}
