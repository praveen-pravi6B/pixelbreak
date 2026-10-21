# Privacy

PixelBreak is **local-first by design**. This document describes exactly what data stays on your machine and what is never transmitted.

---

## What Stays Local

| Data | Where it lives | Never sent to |
|------|---------------|--------------|
| Source code | Your filesystem | Anywhere |
| Screenshots | `.pixelbreak/artifacts/screenshots/` | Anywhere |
| Diff images | `.pixelbreak/artifacts/diffs/` | Anywhere |
| Scan reports | `.pixelbreak/reports/` | Anywhere |
| Baselines | `.pixelbreak/baselines/` | Anywhere |
| Waivers file | `.pixelbreak-waivers.yml` | Anywhere |
| Configuration | `.pixelbreak.yml` | Anywhere |
| AI prompts | Sent to `127.0.0.1:8080` only | Any remote server |
| AI responses | Received from `127.0.0.1:8080` only | Any remote server |

---

## What PixelBreak Never Does

- **No telemetry.** PixelBreak does not collect usage statistics, error reports, or any analytics.
- **No cloud AI calls.** The AI engine connects only to the configured local llama.cpp endpoint. There is no fallback to a hosted inference service.
- **No remote reporting.** Scan results, findings, screenshots, and diffs are stored locally and never uploaded.
- **No auto-updates.** PixelBreak does not phone home to check for updates.
- **No external dependencies at runtime.** Once installed, PixelBreak does not make network calls except to your locally running application (the `baseUrl` in `.pixelbreak.yml`) and the local llama.cpp server.
- **No file modifications without approval.** PixelBreak never modifies your source files. AI-suggested patches are previews that require explicit developer approval.
- **No silent baseline updates.** Baselines are only updated when you explicitly run `pixelbreak baseline update`.

---

## Local AI Data Flow

When PixelBreak sends a finding to the local AI engine:

1. The runner collects the minimum necessary evidence:
   - Finding summary and rule ID
   - Measured element geometry (numbers, not DOM)
   - Relevant computed CSS values
   - An optional short source snippet (≤ 800 characters, if provided)
2. This evidence is sent via HTTP POST to `http://127.0.0.1:8080` (your local llama.cpp server).
3. The response is schema-validated and stored in the scan report on your filesystem.
4. Nothing in this flow involves a network connection outside your machine.

---

## Dashboard

The localhost dashboard (`pixelbreak dashboard`) runs at `http://localhost:3847`:

- It is served by a Node.js HTTP server bound to `127.0.0.1` (not exposed to the network).
- It reads scan reports and artifact images directly from your local `.pixelbreak/` directory.
- It has no backend database, no user accounts, and no external API calls.
- Closing the browser tab does not affect the server; stop it with `Ctrl+C`.

---

## Git Hook

The pre-commit hook installed by `pixelbreak init`:

- Runs `pixelbreak check` on staged files before each commit.
- Does not transmit any data externally.
- Can be bypassed with `PIXELBREAK_BYPASS=1 git commit` (documented for repository owners).

---

## Third-Party Dependencies

All runtime dependencies are open-source and run locally. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for the full list and licenses.

Model weights are not bundled. You download and run them on your own hardware under the model's respective license.

---

## Threat Model

See the forthcoming `docs/threat-model.md` for a complete analysis of trust boundaries, data flows, and mitigations.

---

*PixelBreak is open-source (MIT). You can verify these claims by reading the source code.*
