# PixelBreak

**Local-first responsive breakpoint detection and visual regression testing — no cloud, no account, no drama.**

PixelBreak checks your frontend before every Git commit. It tests only the viewport widths you configure, detects layout failures and visual regressions, shows evidence in a localhost dashboard, and uses a local LLM to explain issues and suggest CSS fixes — without sending your source code or screenshots to any cloud service.

---

## Why PixelBreak?

- **Find where it breaks.** Deterministic horizontal-overflow and layout-clipping detection at exactly the breakpoints your app supports.
- **See what changed.** Pixel-level screenshot diffs with bounding-box evidence and diff overlays.
- **Understand the cause.** A local LLM explains findings and proposes CSS patches — all on your machine.
- **Block bad commits.** A severity-gated pre-commit hook stops high and critical regressions before they land.
- **Stay private.** Zero telemetry. Zero cloud calls. No API key required.

---

## Core Modules

| Module | What it does |
|--------|-------------|
| **Breakpoint Detective** | Configured viewport scans + deterministic layout checks (horizontal overflow, element clipping) |
| **PixelTruth** | Screenshot baselines, pixel-level image diffs, changed-region visualization |
| **Policy Engine** | Severity rules, commit gate decisions, scoped waiver evaluation |
| **Local AI Engine** | llama.cpp adapter — structured explanations and CSS patch proposals |
| **Local Dashboard** | Localhost report UI — screenshots, diffs, AI panel, waiver flow, patch review |
| **Git Integration** | Staged-change-aware pre-commit hook |
| **CLI** | `pixelbreak init`, `check`, `baseline update`, `dashboard`, `review`, `ai status` |

---

## Requirements

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9
- **Playwright** Chromium (auto-installed by Playwright)
- **llama.cpp** running locally on `http://localhost:8080` (for AI features — see [Local AI Setup](#local-ai-setup))

---

## Quick Start

### 1. Install dependencies

```bash
pnpm install
```

### 2. Build all packages

```bash
pnpm build
```

### 3. Start your frontend app

PixelBreak scans a running local server. Start your app first:

```bash
# Example — replace with your own dev server command
pnpm dev   # or npm run dev, yarn dev, etc.
```

To try the built-in broken demo fixture:

```bash
pnpm demo   # starts fixtures/broken-demo on http://localhost:4173
```

### 4. Initialize PixelBreak

```bash
node apps/runner/dist/cli.js init
```

This creates a `.pixelbreak.yml` configuration template and installs the pre-commit Git hook.

### 5. Configure your project

Edit `.pixelbreak.yml` — at minimum, set your app's base URL and the viewport widths you support:

```yaml
version: 1

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
```

See [`.pixelbreak.yml.example`](./.pixelbreak.yml.example) for the full reference.

### 6. Capture baselines

Before the first scan, capture baseline screenshots:

```bash
node apps/runner/dist/cli.js baseline update
```

### 7. Run a scan

```bash
node apps/runner/dist/cli.js check
```

PixelBreak scans each configured route at each configured viewport width, evaluates findings against your severity policy, and exits with code `0` (pass) or `1` (blocked).

---

## CLI Reference

All commands are run from the repository root via:

```bash
node apps/runner/dist/cli.js <command>
```

After npm publishing (post-submission), the command will be `npx pixelbreak <command>`.

| Command | Description |
|---------|-------------|
| `init` | Create `.pixelbreak.yml` template and install pre-commit Git hook |
| `check` | Run responsive + visual regression scan with severity policy gate |
| `check -c <path>` | Use a custom config file |
| `check -w <path>` | Use a custom waivers file |
| `baseline update` | Explicitly capture and approve baseline screenshots |
| `baseline update -c <path>` | Use a custom config file |
| `dashboard` | Start the localhost report dashboard and open in browser *(Phase F)* |
| `review` | Open the latest scan report in the dashboard *(Phase F)* |
| `ai status` | Check local llama.cpp connectivity and model info *(Phase E)* |

---

## Severity Policy

PixelBreak uses a deterministic, rule-based severity system. AI can explain findings but **cannot** change severity decisions.

| Severity | Example | Default Action |
|----------|---------|----------------|
| **Critical** | Essential UI unusable, severe layout failure | Block commit |
| **High** | Required viewport broken, major clipping/overlap | Block commit |
| **Moderate** | Noticeable regression, limited overflow | Require fix or scoped waiver |
| **Low** | Minor non-blocking difference | Allow with report |
| **Informational** | Approved or expected change | Allow |

Configure overrides in `.pixelbreak.yml` under the `severity` key.

---

## Waiver System

For moderate findings you've reviewed and accepted, add a scoped waiver to `.pixelbreak-waivers.yml`:

```yaml
version: 1
waivers:
  - ruleId: horizontal-overflow
    route: /legacy-page
    viewportWidth: 1024
    reason: "Known third-party widget issue, tracked in #1234"
    author: your-github-username
    expiresAt: "2026-12-31"
```

**Rules:**
- Waivers require a `reason` and `author` by default.
- Waivers **cannot** suppress `high` or `critical` findings — those must be fixed.
- Expired waivers are treated as absent.

---

## Local AI Setup

PixelBreak uses a local llama.cpp server for finding explanations and CSS patch proposals. No cloud connection, no API key.

### 1. Install llama.cpp

```bash
# macOS
brew install llama.cpp

# Linux / Windows — build from source:
# https://github.com/ggml-org/llama.cpp
```

### 2. Download a model

Recommended: **Qwen2.5-Coder-7B-Instruct** (GGUF format)

```bash
# Using Hugging Face Hub CLI (no token required for this model)
huggingface-cli download Qwen/Qwen2.5-Coder-7B-Instruct-GGUF \
  qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --local-dir ./models
```

> Verify the model license before use. Qwen2.5 models are released under the Qwen License Agreement. See `THIRD_PARTY_NOTICES.md` for details. PixelBreak does **not** bundle model weights.

### 3. Start the server

```bash
llama-server \
  --model ./models/qwen2.5-coder-7b-instruct-q4_k_m.gguf \
  --port 8080 \
  --ctx-size 4096
```

### 4. Verify connectivity

```bash
node apps/runner/dist/cli.js ai status
```

### Hardware requirements

| Model size | Minimum RAM | Notes |
|-----------|-------------|-------|
| 7B Q4_K_M | ~6 GB | Recommended default |
| 3B Q4_K_M | ~3 GB | Faster, lower quality |
| 14B Q4_K_M | ~10 GB | Slower, higher quality |

---

## Dashboard

After a scan with moderate/high/critical findings, open the localhost report dashboard:

```bash
node apps/runner/dist/cli.js dashboard
```

The dashboard shows:
- Scan summary (pass/block status, counts by severity)
- Findings list (filter by severity, category, route, viewport)
- Finding detail (current screenshot, baseline, diff overlay, measured geometry)
- AI panel (model status, explanation, evidence, proposed CSS patch)
- Patch review (textual diff — explicit approve required, never auto-applied)
- Waiver flow (reason, scope, expiry, audit record)
- Baseline update flow (preview and explicit approve)

The dashboard runs entirely on localhost and requires no remote account or backend.

---

## Running the Demo

The `fixtures/broken-demo` app contains intentional layout issues for testing:

```bash
# Terminal 1 — start the fixture app
pnpm demo

# Terminal 2 — run PixelBreak
node apps/runner/dist/cli.js baseline update   # capture clean baselines
node apps/runner/dist/cli.js check             # expect high-severity findings at 1024px
```

Expected output: PixelBreak detects horizontal overflow on `#metrics-card` at 1024px, evaluates it as `high` severity, and blocks the commit gate.

---

## Development

### Project structure

```
pixelbreak/
├── apps/
│   ├── dashboard/          # React + Vite localhost report UI
│   └── runner/             # Node.js CLI and Playwright scan orchestrator
├── packages/
│   ├── contracts/          # Shared TypeScript types and schemas
│   ├── config/             # .pixelbreak.yml parsing and Zod validation
│   ├── layout-analyzer/    # Deterministic layout check rules
│   ├── visual-diff/        # Baseline management and pixel comparison
│   ├── ai-engine/          # Local LLM adapter and prompt templates
│   ├── policy-engine/      # Severity decisions and waiver evaluation
│   └── git-integration/    # Staged file detection and hook installation
├── fixtures/
│   └── broken-demo/        # Demo app with intentional layout failures
├── tests/
│   ├── unit/
│   └── e2e/
└── docs/                   # Architecture, configuration, model setup, privacy
```

### Commands

```bash
pnpm install          # install all workspace dependencies
pnpm build            # compile all TypeScript packages
pnpm test             # run unit + E2E tests (Vitest)
pnpm test:watch       # watch mode
pnpm typecheck        # type-check without emitting
pnpm lint             # lint all packages
pnpm demo             # start the broken-demo fixture app
```

### Adding a new layout rule

1. Create `packages/layout-analyzer/src/rules/your-rule.ts`
2. Export an `inPage*` function (browser-injected) and a `create*Findings()` factory
3. Wire it into `packages/layout-analyzer/src/index.ts`
4. Add a unit test in `packages/layout-analyzer/test/`

---

## Non-Negotiable Design Constraints

These constraints are enforced by design and must not be bypassed in contributions:

- **Local-only AI.** PixelBreak never sends code, screenshots, or any data to a remote AI service.
- **No required API key.** Normal operation does not require any hosted service token.
- **AI is not the authority.** Deterministic rules drive severity. AI explains findings; it cannot downgrade severity, waive a finding, update a baseline, or apply a patch.
- **No auto-edits.** AI-generated CSS patches are previews. The developer must explicitly approve before any patch is applied.
- **Fail safely.** Incomplete scans do not silently report success.
- **Explicit baseline updates.** Baselines are never overwritten automatically during a check.

---

## Privacy

PixelBreak is local-first by design:

- No telemetry, analytics, or usage reporting.
- No screenshots, source code, or finding data are sent to remote services.
- All scan artifacts (screenshots, diffs, reports) are stored locally under `.pixelbreak/`.
- The local LLM receives only the minimum evidence needed: finding summary, relevant DOM/CSS snippets.

See [`docs/privacy.md`](./docs/privacy.md) for full details.

---

## Third-Party Licenses

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for the full list of runtime dependencies and their licenses.

PixelBreak application code is MIT licensed. Model weights are not bundled and are governed by their respective licenses.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for setup instructions, workflow, and coding standards.

---

## License

MIT — see [`LICENSE`](./LICENSE).
