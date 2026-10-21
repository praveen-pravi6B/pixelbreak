import type { Finding } from '@pixelbreak/contracts'

/**
 * System prompt enforcing structured JSON output and hypothesis labelling.
 * The model is explicitly instructed that it cannot change severity or apply patches.
 */
export const SYSTEM_PROMPT = `You are a frontend CSS debugging assistant integrated into a local regression testing tool called PixelBreak.

Your role:
- Analyse layout findings detected by deterministic layout checks (horizontal overflow, element clipping, visual regression).
- Explain the likely root cause in plain language.
- Propose a minimal, targeted CSS patch when you have sufficient evidence.

Strict rules you must follow:
1. You are providing HYPOTHESES, not verified facts. All explanations are advisory only.
2. You CANNOT change the severity of a finding. Severity is determined by deterministic rules.
3. You CANNOT waive a finding or mark it as resolved.
4. Patches you propose are PREVIEWS. They will never be applied automatically. The developer must approve.
5. Do NOT hallucinate element names, file paths, or CSS values you were not given.
6. If you do not have enough evidence to propose a patch, set "patch" to null.
7. Keep responses concise. Do not repeat the input data back verbatim.

You MUST respond with a single valid JSON object matching this exact schema:
{
  "summary": "<1-2 sentence plain-language description of the issue>",
  "likelyCause": "<your hypothesis about the root cause>",
  "supportingEvidence": ["<item 1>", "<item 2>"],
  "patch": {
    "cssSelector": "<CSS selector>",
    "property": "<CSS property name>",
    "currentValue": "<current value or empty string>",
    "proposedValue": "<proposed replacement value>",
    "diff": "<unified diff of the change>",
    "explanation": "<why this patch addresses the cause>",
    "expectedEffect": "<what should visually change after applying>",
    "validationSteps": ["<step 1>", "<step 2>"]
  },
  "limitations": "<what you are uncertain about or could not determine>"
}

If you cannot suggest a patch, use: "patch": null

Respond with JSON only. No markdown fences. No prose before or after the JSON object.`

/**
 * Build the user-facing prompt for a single finding explanation.
 * Sends only the minimum evidence needed — no full source files.
 */
export function buildExplanationPrompt(finding: Finding, sourceContext?: string): string {
  const lines: string[] = []

  lines.push(`FINDING TO ANALYSE`)
  lines.push(`------------------`)
  lines.push(`Rule:      ${finding.ruleId}`)
  lines.push(`Severity:  ${finding.severity} (determined by deterministic rules — do not change)`)
  lines.push(`Category:  ${finding.category}`)
  lines.push(`Route:     ${finding.route}`)
  lines.push(`Viewport:  ${finding.viewport.width}px × ${finding.viewport.height}px`)

  if (finding.selector) {
    lines.push(`Element:   ${finding.selector}`)
  }

  lines.push(`Summary:   ${finding.summary}`)

  const ev = finding.evidence
  lines.push(`\nEVIDENCE`)
  lines.push(`--------`)
  lines.push(`Description: ${ev.description}`)

  if (ev.measuredGeometry) {
    const g = ev.measuredGeometry
    lines.push(`Measured geometry:`)
    lines.push(`  x=${g.x}, y=${g.y}, width=${g.width}, height=${g.height}`)
    if (g.scrollWidth !== undefined) lines.push(`  scrollWidth=${g.scrollWidth}`)
    if (g.clientWidth !== undefined) lines.push(`  clientWidth=${g.clientWidth}`)
  }

  if (ev.viewportGeometry) {
    lines.push(`Viewport dimensions: ${ev.viewportGeometry.width}×${ev.viewportGeometry.height}`)
  }

  if (ev.computedStyles && Object.keys(ev.computedStyles).length > 0) {
    lines.push(`Computed CSS on element:`)
    for (const [prop, val] of Object.entries(ev.computedStyles)) {
      if (val !== undefined) lines.push(`  ${prop}: ${val}`)
    }
  }

  if (ev.diffPercentage !== undefined) {
    lines.push(`Visual diff: ${ev.diffPercentage.toFixed(3)}% of pixels changed`)
  }

  if (sourceContext) {
    lines.push(`\nSOURCE CONTEXT (excerpt — do not assume the full file)`)
    lines.push(`------------------------------------------------------`)
    lines.push(sourceContext.slice(0, 800))
  }

  lines.push(`\nProvide your JSON analysis now.`)
  return lines.join('\n')
}
