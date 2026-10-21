# Severity Policy

PixelBreak uses a **deterministic, rule-based severity system**.
AI can explain findings and suggest patches — but it **cannot** change severity, waive a finding, or approve a baseline.

---

## Severity Levels

| Level | Description | Default action |
|-------|-------------|----------------|
| **Critical** | Essential UI is unusable or a severe layout failure makes the page non-functional | Block commit |
| **High** | A required viewport is broken, or there is major element clipping/overlap | Block commit |
| **Moderate** | Noticeable regression or limited overflow that degrades UX | Require fix or scoped waiver |
| **Low** | Minor non-blocking visual difference | Allow with report entry |
| **Informational** | Approved or expected change | Allow |

---

## How Severity Is Determined

Severity is assigned by the **deterministic layout rules** in `@pixelbreak/layout-analyzer` and `@pixelbreak/visual-diff`. Measured evidence drives the decision.

### Horizontal Overflow Rule (`horizontal-overflow`)

| Condition | Severity |
|-----------|----------|
| Overflow ≥ 20px beyond viewport | **High** |
| Overflow < 20px beyond viewport | **Moderate** |

Evidence collected: element selector, `x/y/width/height`, `scrollWidth`, `clientWidth`, computed CSS.

### Element Clipping Rule (`element-clipping`)

| Condition | Severity |
|-----------|----------|
| Clipped content > 50px | **High** |
| Clipped content ≤ 50px | **Moderate** |

### Visual Regression Rule (`visual-regression`)

| Condition | Severity |
|-----------|----------|
| Pixel diff ≥ 2% of total pixels | **High** |
| Pixel diff between 0.05% and 2% | **Moderate** |
| Pixel diff < 0.05% | Pass (no finding) |

Threshold is configurable per project.

---

## Commit Gate

| Decision | Condition |
|----------|-----------|
| **PASS** | No blocked findings and all moderate findings are waived |
| **BLOCK** | Any critical/high finding, or any moderate finding without a valid waiver |

On block:
- CLI prints the dashboard URL (`http://localhost:3847`)
- Exit code `1` is returned (pre-commit hook blocks the commit)
- AI explains the finding if llama.cpp is running

Emergency bypass (repository owners only — use sparingly):

```bash
PIXELBREAK_BYPASS=1 git commit
```

This bypasses the local hook. CI enforcement should be set up separately to maintain the same policy.

---

## Waiver System

Waivers allow **moderate** findings to be acknowledged and deferred. They cannot suppress high or critical findings.

### Valid waiver requirements

1. `reason` — a human-readable explanation (required by default)
2. `author` — who approved the waiver
3. Optional `expiresAt` — waivers should not be indefinite

### Waiver matching

Waivers are matched by finding scope (all fields are optional, combined with AND):
- `findingId` — exact finding ID (most precise)
- `ruleId` — all findings from a specific rule
- `route` — findings on a specific route
- `viewportWidth` — findings at a specific viewport width

### What waivers cannot do

- Suppress a `high` or `critical` finding (enforced by policy engine)
- Bypass scanner errors when `failOnScannerError: true`
- Be applied retroactively after expiry

---

## AI and Severity

The local AI engine (`@pixelbreak/ai-engine`) produces **hypotheses** — explanations and patch proposals for human review. It interacts with severity in the following ways:

| AI action | Allowed? |
|-----------|----------|
| Explain why a finding has its severity | Yes — advisory only |
| Suggest a CSS patch | Yes — preview only, never auto-applied |
| Downgrade severity from high to moderate | **No — enforced in code** |
| Waive a finding | **No** |
| Approve a baseline update | **No** |
| Apply a patch automatically | **No** |

All AI output is tagged `isHypothesis: true` and displayed with a "NOT VERIFIED" banner in the dashboard.

---

## Scanner Errors

When `failOnScannerError: true` (the safe default):
- A scanner error that prevents a route/viewport from being tested causes a **block** decision
- Incomplete scans never silently report success

To proceed despite a scanner error, fix the underlying issue (e.g., ensure the dev server is running) or use the emergency bypass.
