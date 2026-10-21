# Contributing to PixelBreak

Thank you for your interest in contributing! PixelBreak is a local-first, open-source frontend regression testing tool. This guide covers how to set up the project, submit changes, and stay aligned with the project's core design constraints.

---

## Table of Contents

- [Project Setup](#project-setup)
- [Branch and PR Workflow](#branch-and-pr-workflow)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Package Structure Guide](#package-structure-guide)
- [Non-Negotiable Constraints](#non-negotiable-constraints)
- [Getting Help](#getting-help)

---

## Project Setup

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **Git**

### Install and build

```bash
# Clone the repository
git clone https://github.com/praveen-pravi6B/pixelbreak.git
cd pixelbreak

# Install all workspace dependencies
pnpm install

# Build all packages and apps
pnpm build

# Verify the test suite passes
pnpm test
```

### Run the broken demo fixture

```bash
# Terminal 1 — start the demo app
pnpm demo

# Terminal 2 — run a scan
node apps/runner/dist/cli.js baseline update
node apps/runner/dist/cli.js check
```

---

## Branch and PR Workflow

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   # or
   git checkout -b fix/your-bug-description
   ```

2. **Make your changes.** Keep commits focused — one logical change per commit.

3. **Run tests before pushing:**
   ```bash
   pnpm build && pnpm test
   ```

4. **Open a Pull Request** against `main`. Include:
   - A clear description of what changed and why
   - Steps to reproduce (for bug fixes)
   - Test output showing the change works

5. PRs must pass all CI checks before merging.

---

## Code Style

- **Language:** TypeScript, ESM (`"type": "module"`), strict mode.
- **Validation:** Use **Zod** for all schema/config validation. Do not write ad-hoc type narrowing where a Zod schema will do.
- **Formatting:** Follow the existing code style (2-space indentation, single quotes, no semicolons in most files — match the surrounding code).
- **Imports:** Use `.js` extensions in ESM import paths (TypeScript resolves these correctly with `NodeNext` module resolution).
- **No external services:** Never add a dependency that makes a network call to a remote service during normal operation.
- **Comments:** Write comments only where logic is non-obvious. Do not write redundant JSDoc on every function.

---

## Testing Requirements

Every code change must include appropriate tests. PixelBreak uses:

- **Vitest** for unit tests (fast, in-process)
- **Playwright** for end-to-end tests (requires the demo app running)

### Unit tests

Place unit tests in the package's `test/` directory:

```
packages/layout-analyzer/
└── test/
    └── analyzer.test.ts
```

Run unit tests:
```bash
pnpm test
```

### End-to-end tests

Place E2E tests in `tests/e2e/`. They require a running instance of `fixtures/broken-demo` (started automatically by the test harness).

### Acceptance criteria

- New layout detection rules: include a unit test that verifies detection on a known fixture.
- New CLI commands: include an integration test verifying exit code and output.
- Policy changes: include tests for all affected severity levels and waiver edge cases.
- Visual diff changes: include tests for both within-threshold and above-threshold cases.

---

## Package Structure Guide

PixelBreak is a **pnpm monorepo**. Each package is small, typed, and has a single responsibility.

```
packages/
├── contracts/          # Shared TypeScript types — no runtime dependencies
├── config/             # Config loading and Zod validation
├── layout-analyzer/    # Browser-injected layout check rules
├── visual-diff/        # Pixel comparison and baseline management
├── ai-engine/          # Local LLM adapter only — no hosted inference
├── policy-engine/      # Severity rules and waiver evaluation
└── git-integration/    # Git hook installation and staged file detection

apps/
├── runner/             # CLI entry point and Playwright orchestrator
└── dashboard/          # React + Vite localhost report UI
```

### Adding a new package

1. Create `packages/your-package/` with `package.json`, `tsconfig.json`, and `src/index.ts`.
2. Add it to the relevant internal package's `dependencies` (using the `workspace:*` protocol).
3. Export only what other packages need — keep internals private.
4. Add at least one unit test.

### Adding a new layout rule

1. Create `packages/layout-analyzer/src/rules/your-rule.ts`
2. Export:
   - An `inPage*()` function — this runs inside the browser via Playwright's `page.evaluate()`. It must be self-contained (no imports, no closure captures from Node.js scope).
   - A `create*Findings()` factory — converts raw browser output into `Finding[]` objects using types from `@pixelbreak/contracts`.
3. Wire it into `packages/layout-analyzer/src/index.ts`.
4. Add a unit test.

---

## Non-Negotiable Constraints

These constraints reflect the product's core design and must not be violated in any contribution:

| Constraint | Why |
|-----------|-----|
| **Local-only AI** | PixelBreak's privacy promise. No code, screenshots, or reports may be sent to a remote service. |
| **No required API key** | Normal operation must work without any hosted service authentication. |
| **AI cannot change severity** | Severity is determined by deterministic rules and measured evidence. AI output is advisory only. |
| **AI cannot waive findings** | Waivers require explicit human authorship and reason. |
| **AI cannot update baselines** | Baselines must be explicitly approved by the developer via `pixelbreak baseline update`. |
| **AI patches are previews only** | Patches must be shown to the developer and explicitly approved before any file is modified. |
| **Fail safely** | An incomplete scan must not silently report success. |
| **No automatic source edits** | PixelBreak must never modify the user's source files without explicit approval. |

Any PR that violates these constraints will not be merged regardless of other quality.

---

## Getting Help

- Open a [GitHub Issue](https://github.com/praveen-pravi6B/pixelbreak/issues) for bugs or questions.
- Check `IMPLEMENTATION_STATUS.md` for the current state of each phase.
- Check `PLAN.md` for the full product specification and design rationale.
