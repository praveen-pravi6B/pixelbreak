# PixelBreak --- Implementation Plan for Claude Code

> **Purpose:** Build PixelBreak, a local-first, fully open-source
> frontend regression testing tool combining responsive breakpoint
> detection and visual regression analysis.
>
> **Submission target:** Hacktoberfest Week 3, October 25, 2026.
>
> **Important:** Implement the MVP first. Do not add hosted AI or
> Hugging Face inference before the submission.

## 1. Product vision

PixelBreak checks a developer's local frontend project before a Git
commit. It tests only the configured viewport widths, detects layout
failures and visual regressions, shows evidence in a localhost
dashboard, and uses a local LLM to explain issues and suggest CSS fixes.

**Product promise:** Find where a frontend breaks, show what changed,
and explain how to fix it --- without sending source code or screenshots
to a cloud AI service.

### Core modules

-   **Breakpoint Detective:** configured viewport scans and
    deterministic layout checks.
-   **PixelTruth:** screenshot baselines, image diffs, and
    changed-region visualization.
-   **Policy Engine:** severity rules, commit decisions, and scoped
    waivers.
-   **Local AI Engine:** local-model explanations and proposed CSS
    patches.
-   **Local Dashboard:** reports, screenshots, evidence, and review
    actions.
-   **Git Integration:** staged-change-aware pre-commit checks.
-   **CLI:** project initialization, scans, report opening, baseline
    management, and hook installation.

## 2. Non-negotiable product requirements

1.  **Local-only AI for the Hacktoberfest submission.** Do not implement
    hosted inference, Hugging Face Inference Providers, or cloud AI
    fallback in the MVP.
2.  **No required Hugging Face token.** Public-model downloads may work
    without authentication; gated downloads can be documented
    separately. Never require a token for normal operation.
3.  **Custom viewport profiles.** Desktop-only applications must not be
    tested at mobile widths unless configured. Only configured,
    supported widths are in scope.
4.  **Real visual reports.** Moderate, high, and critical findings must
    be available in a localhost dashboard with actual screenshots,
    evidence, and diffs.
5.  **Severity-based Git gate.** High and critical findings block
    commits. Moderate findings are shown in the dashboard and require a
    documented, scoped waiver or a fix before proceeding.
    Low/informational findings do not block by default.
6.  **AI is not the authority for severity.** Deterministic rules and
    measured evidence drive severity. AI explains findings and suggests
    fixes; it cannot downgrade severity.
7.  **Fail safely.** If a required scan is incomplete, do not silently
    report success. If required local AI analysis is unavailable for a
    finding that needs it, show a clear failure and block unresolved
    high/critical findings.
8.  **No automatic source edits.** AI-generated patches are previews.
    The developer must explicitly approve a patch before it is applied.
9.  **Local-first privacy.** Do not send code, screenshots, telemetry,
    or reports to remote services.
10. **Post-submission plans are deferred.** npm publishing and optional
    Hugging Face integration are future work, not MVP dependencies.

## 3. Recommended stack

Use the smallest dependable stack that supports a polished end-to-end
demo.

-   **Monorepo/package manager:** pnpm workspaces.
-   **Dashboard:** React + TypeScript + Vite.
-   **CLI/orchestrator:** Node.js + TypeScript.
-   **Browser automation:** Playwright.
-   **Visual comparison:** Pixelmatch (or an equivalent well-tested
    open-source image diff library).
-   **Persistence:** SQLite for scan metadata; local files for
    screenshots, diff images, and reports.
-   **Local LLM runtime:** llama.cpp, accessed through a local HTTP
    endpoint or a thin adapter.
-   **Candidate model:** Qwen2.5-Coder-Instruct in a size/quantization
    that fits the user's hardware. Verify the exact checkpoint's license
    and test quality before recommending it as the default. Do not
    bundle model weights.
-   **Testing:** Vitest for unit tests and Playwright for end-to-end
    tests.
-   **License:** MIT for PixelBreak application code, with third-party
    and model licenses documented separately.

Avoid adding a database server, cloud service, authentication, or
multiple browser engines in the MVP.

## 4. Repository structure

Create or adapt this structure. Keep modules small and use shared typed
contracts.

``` text
pixelbreak/
├── apps/
│   ├── dashboard/              # React + Vite local report UI
│   └── runner/                 # Node.js scan orchestration and local server
├── packages/
│   ├── contracts/              # Shared types and schemas
│   ├── config/                 # .pixelbreak.yml parsing and validation
│   ├── layout-analyzer/        # Deterministic layout checks
│   ├── visual-diff/            # Baselines, diff images, changed regions
│   ├── ai-engine/              # Local LLM adapter, prompts, output validation
│   ├── policy-engine/           # Severity decisions and waiver evaluation
│   ├── git-integration/        # Staged files and hook installation
│   └── report/                  # Report persistence and serialization
├── fixtures/
│   └── broken-demo/             # Small frontend with known layout failures
├── tests/
│   ├── unit/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   ├── local-model-setup.md
│   ├── severity-policy.md
│   ├── privacy.md
│   └── threat-model.md
├── .github/workflows/
├── .pixelbreak.yml.example
├── .gitignore
├── LICENSE
├── THIRD_PARTY_NOTICES.md
├── README.md
├── CONTRIBUTING.md
├── package.json
└── pnpm-workspace.yaml
```

Do not create every package as an empty abstraction on day one. Build
the end-to-end path first, then extract modules when there is a clear
need.

## 5. Configuration

Use a version-controlled `.pixelbreak.yml` file. Validate it on startup
and provide actionable errors for invalid settings.

Example:

``` yaml
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
  requiredForExplanations: true
  requiredForFixSuggestions: true
```

Rules: - Widths below `minWidth` are out of scope, not failures. -
Explicit widths and configured routes are the initial MVP scan
surface. - Do not infer that every application must support mobile. -
Make defaults safe and clear; never silently expand the viewport
range. - A moderate waiver must include a reason and a scope. Support
optional expiry. - Normal waiver rules cannot suppress high or critical
issues.

## 6. Finding/report data contract

Use a stable, versioned finding schema. At minimum, include:

-   `id`: stable finding identifier.
-   `ruleId`: deterministic rule that detected the issue.
-   `severity`: `critical | high | moderate | low | informational`.
-   `category`: `layout | visual-regression | scanner | ai`.
-   `route` and `viewport` dimensions.
-   `selector` or element description, when available.
-   `summary` and `evidence` generated by deterministic analysis.
-   `baselineImage`, `currentImage`, and `diffImage` artifact references
    when applicable.
-   Relevant measured geometry and selected computed CSS values.
-   Optional `aiExplanation`, `rootCauseHypotheses`, and
    `suggestedPatch`.
-   `status`: `open | waived | fixed | approved-baseline`.
-   Scan ID, timestamp, and tool version.

Clearly distinguish measured facts from AI hypotheses. Validate model
responses against a schema and treat model output as untrusted text.

## 7. Scanner behavior

Implement in this order:

1.  Start or connect to the configured local application.
2.  Validate the base URL and configured routes.
3.  Run Playwright at each configured viewport width.
4.  Wait for a predictable page-ready condition and document the
    limitation of arbitrary app readiness.
5.  Capture screenshots and relevant DOM geometry.
6.  Detect horizontal overflow and selected obvious layout failures
    deterministically.
7.  Save baseline screenshots and compare subsequent screenshots.
8.  Generate a diff image and changed-region evidence.
9.  Produce a report and return a machine-readable exit code.
10. Open or link to the localhost report when moderate/high/critical
    findings occur.

For visual diffs, control viewport dimensions and device scale factor.
Document sources of screenshot noise such as animations, timestamps,
fonts, and asynchronous content. Add a mechanism to disable animations
and mask explicitly dynamic regions if feasible.

Do not claim a generic pixel difference is automatically a layout bug.
Visual changes need a configurable threshold and should be presented as
evidence for review.

## 8. Severity policy and commit gate

Initial default policy:

  -----------------------------------------------------------------------
  Severity                Example                 Default action
  ----------------------- ----------------------- -----------------------
  Critical                Essential UI unusable   Block
                          or severe layout        
                          failure                 

  High                    Required viewport       Block
                          broken, major           
                          clipping/overlap        

  Moderate                Noticeable regression   Dashboard review;
                          or limited overflow     require fix or scoped
                                                  waiver

  Low                     Minor non-blocking      Allow with report
                          difference              

  Informational           Approved or expected    Allow
                          change                  
  -----------------------------------------------------------------------

The deterministic policy engine assigns severity from measured evidence
and configurable rules. AI may recommend a severity for human review,
but must not alter the final policy decision.

### Pre-commit requirements

-   Install a repository-local Git hook through `pixelbreak init`.
-   Identify staged changes. Do not accidentally include unrelated
    unstaged edits in the check.
-   For the first MVP, scanning all configured routes is acceptable and
    safer than incomplete affected-route analysis.
-   On moderate findings, show the localhost report and require a fix or
    scoped waiver.
-   On high/critical findings, show the localhost report and block the
    commit.
-   Provide a clear terminal summary with the report URL and
    instructions to rerun.
-   Never wait indefinitely for a browser action. Use an explicit
    timeout; timeout means the commit remains blocked when approval is
    required.
-   Provide a documented emergency bypass for repository owners, but do
    not make it the normal path. Git hooks can be bypassed, so CI must
    eventually enforce the same policy.
-   Do not silently update baselines during a check. Baseline updates
    must be explicit.

## 9. Local dashboard requirements

The dashboard must run on localhost and show real scan artifacts.

Required views: - Scan summary: pass/block status, counts by severity,
timestamp, commit/ref when available. - Findings list: filter by
severity, category, route, and viewport. - Finding detail: current
screenshot, baseline screenshot, diff overlay, affected element,
measured geometry, and rule explanation. - AI panel: model/runtime
status, explanation, evidence referenced, suggested CSS patch, and
limitations. - Patch review: show a textual diff and require explicit
approval; do not auto-edit files. - Waiver flow: reason, affected
finding, scope, optional expiry, and audit record. - Baseline update
flow: preview differences and require explicit approval. - Clear status
when the local model is unavailable.

When a moderate/high/critical finding is detected, the CLI should print
the local report URL and attempt to open it. If a dashboard server
already exists, reuse it. The Git hook should use a bounded local
approval protocol rather than waiting forever for a page to be closed.

The dashboard should not require a remote account, external analytics,
or a hosted backend.

## 10. Local AI behavior

The local AI is required for explanations and fix suggestions in the
MVP, but it does not replace deterministic checks.

-   Connect only to the configured local llama.cpp endpoint.
-   Make endpoint/model configuration explicit and validate local
    connectivity.
-   Send only the minimum evidence needed: finding details, relevant
    DOM/CSS, and focused source snippets.
-   Ask for structured output: summary, likely cause, supporting
    evidence, minimal patch, expected effect, and validation steps.
-   Validate output structure and reject malformed responses.
-   Label explanations as hypotheses unless independently verified.
-   Never let AI downgrade severity, waive a finding, update a baseline,
    or apply a patch.
-   Validate a proposed patch in a temporary worktree/copy and rerun the
    affected test before presenting validation results.
-   If the local model is unavailable, show an actionable error. Do not
    silently use hosted inference.
-   Do not bundle large model weights in the application package.
    Document model setup, resource requirements, and exact license.
-   Do not require an HF token in the MVP.

## 11. CLI commands to implement

These are intended command names; adjust if the implementation or chosen
CLI library requires it, but document the final interface consistently.

``` bash
# Initialize config and install the pre-commit hook
npx pixelbreak init

# Run the configured scan
npx pixelbreak check

# Open or start the localhost dashboard
npx pixelbreak dashboard

# Review the latest report
npx pixelbreak review

# Explicitly approve a baseline update
npx pixelbreak baseline update

# Check local AI connectivity
npx pixelbreak ai status
```

During the hackathon, commands may be run from the repository using the
package manager. npm publishing is a post-submission milestone, not a
prerequisite.

## 12. Implementation sequence and acceptance criteria

### Phase A --- Foundation

-   Create the workspace, TypeScript settings, lint/test scripts,
    license, and demo app.
-   Add a sample desktop-only config.
-   Acceptance: clean install succeeds and the demo app starts.

### Phase B --- Breakpoint Detective

-   Implement configurable viewport sweeps and Playwright screenshots.
-   Detect horizontal overflow and at least one additional deterministic
    layout issue.
-   Acceptance: known broken fixture is detected at configured widths;
    widths outside the profile are not tested or reported.

### Phase C --- PixelTruth

-   Implement explicit baseline creation, comparison, diff artifacts,
    and a screenshot viewer.
-   Acceptance: a controlled CSS change creates a visible diff;
    unchanged pages pass within the configured threshold.

### Phase D --- Policy and Git hook

-   Implement severity policy, moderate waivers, blocking exit codes,
    and hook installation.
-   Acceptance: high/critical findings block a commit; a valid scoped
    moderate waiver works; invalid/expired waivers fail; scanner errors
    do not silently pass.

### Phase E --- Local AI

-   Connect to llama.cpp and implement structured explanations and patch
    suggestions.
-   Acceptance: AI can explain a known fixture issue and produce a patch
    proposal; the patch is never silently applied; no hosted AI requests
    occur.

### Phase F --- Dashboard

-   Display actual findings, screenshots, diffs, evidence, AI analysis,
    and waiver actions.
-   Acceptance: a moderate/high finding opens a usable localhost report;
    a high finding remains blocking until fixed; required review has a
    bounded timeout.

### Phase G --- Release readiness

-   Add tests, clean-checkout setup, documentation, privacy notes,
    third-party notices, and demo recording.
-   Acceptance: a reviewer can follow the README and reproduce the demo
    without a paid API key.

## 13. Suggested time budget

Work to the deadline, prioritizing a complete vertical slice:

1.  **First:** scanner and deliberately broken demo.
2.  **Second:** screenshot baseline and diff.
3.  **Third:** severity policy and pre-commit block.
4.  **Fourth:** localhost report dashboard.
5.  **Fifth:** local AI explanation and patch suggestion.
6.  **Last:** visual polish, docs, tests, and demo.

If time is short, reduce the number of layout rules and routes rather
than weakening the blocking behavior or faking AI output.

## 14. Testing checklist

-   [ ] Desktop-only profile does not test mobile widths.
-   [ ] Configured widths are tested exactly.
-   [ ] Horizontal overflow in the demo is detected.
-   [ ] Screenshot baseline and diff are reproducible.
-   [ ] Moderate finding opens the dashboard and requires a waiver or
    fix.
-   [ ] High/critical finding opens the dashboard and blocks the commit.
-   [ ] Expired or invalid waiver does not suppress a finding.
-   [ ] Model-unavailable state is visible and does not silently pass
    unresolved blocking findings.
-   [ ] AI output is schema-validated and cannot change severity.
-   [ ] AI patches are previews and are never silently applied.
-   [ ] Staged changes are handled correctly.
-   [ ] No source code, screenshots, or telemetry are sent to a remote
    service.
-   [ ] A clean checkout can reproduce the demo.

## 15. Post-submission roadmap --- do not implement before submission

After the Hacktoberfest submission: - Polish the CLI and publish the
package to npm. - Test `npm pack` and install the tarball into a clean
sample project. - Add an optional Hugging Face provider behind the same
AI adapter interface. - Keep local inference the default. - Let each
user supply their own HF token; never embed a maintainer's token in the
package or browser bundle. - Make hosted inference explicitly opt-in and
explain that source snippets/screenshots may leave the machine. - Add CI
enforcement, improved route-impact analysis, and additional browser
support.

## 16. Instructions to Claude Code

1.  Inspect the existing repository before changing anything. Preserve
    existing work and do not overwrite files without understanding them.
2.  If the repository is empty, scaffold the minimum structure required
    for Phase A.
3.  Implement one phase at a time in the sequence above. Do not generate
    the entire product as untested boilerplate.
4.  After each phase, run relevant tests and fix failures before
    continuing.
5.  Keep a short `IMPLEMENTATION_STATUS.md` with completed work,
    commands run, known issues, and the next concrete task.
6.  Ask before destructive operations, dependency choices that
    materially change the architecture, or any action that would publish
    a package or expose credentials.
7.  Do not claim a feature works unless it has been implemented and
    tested.
8.  At each milestone, summarize changed files, tests and results,
    limitations, and the next step.
9.  Prioritize a reproducible end-to-end demo over speculative features
    or UI polish.
10. Before submission, verify the deadline, required DEV challenge tag,
    and submission instructions from the official challenge page rather
    than assuming them.

**Start now:** inspect the repository and report its current state. Then
implement Phase A only, unless a working foundation already exists; in
that case, preserve it and proceed to the earliest incomplete phase.
