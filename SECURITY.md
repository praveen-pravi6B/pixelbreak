# Security Policy

## Supported Versions

PixelBreak is currently in active development (v0.1.x). Security fixes are applied to the latest version only.

| Version | Supported |
|---------|-----------|
| 0.1.x (latest) | ✅ |
| < 0.1.0 | ❌ |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub Issues.**

To report a vulnerability, open a [GitHub Security Advisory](https://github.com/praveen-pravi6B/pixelbreak/security/advisories/new) on this repository. This keeps the report private until a fix is released.

Include:
- A clear description of the vulnerability
- Steps to reproduce
- Potential impact
- A suggested fix if you have one

You can expect an acknowledgement within **48 hours** and a fix or mitigation plan within **7 days** for critical issues.

---

## Security Design

PixelBreak is a **local-first** tool. Its security model is:

- **No network calls to remote services** — all scan data stays on your machine
- **No bundled credentials or API keys** — the tool requires no authentication to run
- **Pre-commit hook runs as the developer** — it has the same file system permissions as the user
- **AI runs locally** — only connects to `127.0.0.1` (llama.cpp), never to cloud endpoints
- **No auto-edits** — PixelBreak never modifies source files without explicit approval
- **Artifact serving restricted** — the dashboard HTTP server validates all file paths are within `.pixelbreak/` before serving

### Known trust boundaries

- `.pixelbreak.yml` and `.pixelbreak-waivers.yml` are read from the project directory. Malicious config files in untrusted projects could affect scan behaviour — do not run PixelBreak against untrusted projects.
- The pre-commit hook runs `node` — ensure your Node.js version is up to date.

---

## Third-Party Dependencies

See [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md) for all runtime dependencies and their licenses.

For known CVEs in dependencies, check `pnpm audit`.
