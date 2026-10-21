import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadReport, listReports } from './report-store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const DASHBOARD_DIST = path.resolve(__dirname, '../../dashboard/dist')
const PORT = 3847

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

/**
 * Start a lightweight localhost HTTP server that serves:
 * - The pre-built React dashboard static files
 * - GET /api/reports/latest → latest ScanReport JSON
 * - GET /api/reports        → list of all report scan IDs
 * - GET /api/reports/:id    → specific ScanReport JSON
 * - GET /artifacts/*        → screenshot and diff images from outputDir
 */
export function startDashboardServer(outputDir: string): Promise<{ port: number; url: string }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/'

      // API routes
      if (url.startsWith('/api/reports')) {
        return handleApiReports(req, res, url, outputDir)
      }

      // Artifact serving (screenshots, diffs)
      if (url.startsWith('/artifacts/')) {
        return handleArtifact(req, res, url, outputDir)
      }

      // Static dashboard files
      return handleStatic(req, res, url)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${PORT} is already in use. Dashboard may already be running at http://localhost:${PORT}`))
      } else {
        reject(err)
      }
    })

    server.listen(PORT, '127.0.0.1', () => {
      resolve({ port: PORT, url: `http://localhost:${PORT}` })
    })
  })
}

function handleApiReports(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string,
  outputDir: string
): void {
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', '*')

  // GET /api/reports — list all reports
  if (url === '/api/reports' || url === '/api/reports/') {
    const ids = listReports(outputDir)
    res.writeHead(200)
    res.end(JSON.stringify({ reports: ids }))
    return
  }

  // GET /api/reports/latest or /api/reports/:id
  const match = url.match(/^\/api\/reports\/(.+)$/)
  if (!match) {
    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  const scanId = match[1]
  const report = loadReport(scanId, outputDir)
  if (!report) {
    res.writeHead(404)
    res.end(JSON.stringify({
      error: `No report found for "${scanId}". Run pixelbreak check to generate one.`
    }))
    return
  }

  res.writeHead(200)
  res.end(JSON.stringify(report))
}

function handleArtifact(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string,
  outputDir: string
): void {
  // /artifacts/<absolute-path> — serve the file directly
  // The client encodes the absolute path after /artifacts/
  const encodedPath = url.slice('/artifacts/'.length)
  const filePath = decodeURIComponent(encodedPath)

  // Validate that the resolved path is within the outputDir to prevent traversal
  const artifactRoot = path.resolve(outputDir, 'artifacts')
  const resolvedPath = path.resolve(filePath)
  if (!resolvedPath.startsWith(artifactRoot + path.sep) && resolvedPath !== artifactRoot) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  if (!fs.existsSync(resolvedPath)) {
    res.writeHead(404)
    res.end('Artifact not found')
    return
  }

  const ext = path.extname(resolvedPath)
  const mime = MIME[ext] ?? 'application/octet-stream'
  res.setHeader('Content-Type', mime)
  res.writeHead(200)
  fs.createReadStream(resolvedPath).pipe(res)
}

function handleStatic(
  _req: http.IncomingMessage,
  res: http.ServerResponse,
  url: string
): void {
  if (!fs.existsSync(DASHBOARD_DIST)) {
    res.writeHead(503, { 'Content-Type': 'text/html' })
    res.end(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0f1117;color:#e2e8f0">
        <h2>Dashboard not built</h2>
        <p>Run <code>pnpm build</code> from the repository root to build the dashboard.</p>
      </body></html>
    `)
    return
  }

  // Normalize path — serve index.html for SPA routes
  let filePath = path.join(DASHBOARD_DIST, url === '/' ? 'index.html' : url)

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DASHBOARD_DIST, 'index.html')
  }

  const ext = path.extname(filePath)
  const mime = MIME[ext] ?? 'text/html; charset=utf-8'
  res.setHeader('Content-Type', mime)
  res.writeHead(200)
  fs.createReadStream(filePath).pipe(res)
}
