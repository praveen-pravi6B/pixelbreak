# Configuration Reference

PixelBreak is configured with a `.pixelbreak.yml` file at the root of your project.
Run `pixelbreak init` to generate a template.

---

## Full Example

```yaml
version: 1

project:
  name: my-app
  baseUrl: http://localhost:4173
  routes:
    - /
    - /dashboard
    - /settings

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
  model: qwen2.5-coder-7b
  requiredForExplanations: true
  requiredForFixSuggestions: true
```

---

## Fields

### `version`

| Field | Type | Required | Value |
|-------|------|----------|-------|
| `version` | integer | yes | `1` |

Always set to `1` for the current schema version.

---

### `project`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Display name for reports and CLI output |
| `baseUrl` | string | yes | Base URL of your running local app (e.g. `http://localhost:4173`) |
| `routes` | string[] | yes | List of routes to scan (e.g. `/`, `/about`) |

Your app must be running and accessible at `baseUrl` before `pixelbreak check` runs.

---

### `viewports`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `profile` | string | yes | `desktop-only` \| `mobile-only` \| `responsive` \| `custom` |
| `minWidth` | integer | yes | Widths below this value are out of scope (not failures) |
| `maxWidth` | integer | yes | Widths above this value are out of scope |
| `widths` | integer[] | yes | Exact viewport widths to test (must be within min/max range) |
| `height` | integer | no | Viewport height in pixels (default: `900`) |
| `required` | boolean | no | Reserved for future use |

**Rules:**
- Only widths within `[minWidth, maxWidth]` are tested.
- Widths outside the configured range are **not** reported as failures — they are simply not tested.
- Do not configure mobile widths for desktop-only applications.
- Never expand the viewport range silently — configure only the widths your app supports.

---

### `checks`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `responsive` | boolean | yes | Enable horizontal overflow and layout clipping detection |
| `visualRegression` | boolean | yes | Enable pixel-level screenshot comparison against baselines |
| `failOnScannerError` | boolean | yes | Block the commit if the scanner fails to complete (safe default: `true`) |

---

### `severity`

Maps each severity level to a policy action.

| Severity | Default action | Description |
|----------|---------------|-------------|
| `critical` | `block` | Block the commit |
| `high` | `block` | Block the commit |
| `moderate` | `require-waiver` | Require a fix or a scoped, documented waiver |
| `low` | `allow` | Allow with report entry |
| `informational` | `allow` | Allow |

**Actions:**
- `block` — commit is rejected; finding must be fixed
- `require-waiver` — finding must either be fixed or have a valid waiver
- `allow` — finding is recorded but does not block the commit

---

### `waivers`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | string | yes | Path to the waivers file (relative to project root) |
| `requireReason` | boolean | yes | Reject waivers without a `reason` field |
| `allowExpiry` | boolean | yes | Allow waivers with an `expiresAt` date |

**Waiver rules:**
- Waivers **cannot** suppress `high` or `critical` findings — those must be fixed.
- A waiver requires a `reason` and `author` when `requireReason: true`.
- Expired waivers (past `expiresAt`) are treated as absent.
- The waiver file is loaded fresh on each `pixelbreak check` run.

#### Waiver file format (`.pixelbreak-waivers.yml`)

```yaml
version: 1
waivers:
  - id: waiver-abc123
    ruleId: horizontal-overflow
    route: /legacy-reports
    viewportWidth: 1024
    reason: "Known issue with third-party widget. Tracked in #4521."
    author: your-github-username
    createdAt: "2026-10-21T00:00:00.000Z"
    expiresAt: "2027-01-01"
```

Waiver scope fields (all optional, combined with AND logic):
- `findingId` — match a specific finding by ID (most precise)
- `ruleId` — match all findings from a specific rule
- `route` — restrict to a specific route
- `viewportWidth` — restrict to a specific viewport width

---

### `ai`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `provider` | `"local"` | yes | Always `"local"` in the MVP — no hosted inference |
| `endpoint` | string | no | llama.cpp server URL (default: `http://localhost:8080`) |
| `model` | string | no | Model name for display and request labelling |
| `requiredForExplanations` | boolean | yes | If `true` and AI is unavailable, show a clear error for blocked findings |
| `requiredForFixSuggestions` | boolean | yes | If `true` and AI is unavailable, no patch proposals are shown |

See [local-model-setup.md](./local-model-setup.md) for llama.cpp installation instructions.
