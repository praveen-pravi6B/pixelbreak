import type {
  Finding,
  PixelBreakConfig,
  Waiver,
  PolicyEvaluationResult,
  FindingEvaluation,
  SeverityLevel,
} from '@pixelbreak/contracts';

export interface EvaluatePolicyOptions {
  findings: Finding[];
  config: PixelBreakConfig;
  waivers?: Waiver[];
  scanId: string;
  now?: Date;
}

export function evaluateWaiverMatch(
  waiver: Waiver,
  finding: Finding,
  config: PixelBreakConfig,
  now: Date = new Date()
): { matched: boolean; reason?: string } {
  // Rule: Normal waiver rules cannot suppress high or critical issues.
  if (finding.severity === 'critical' || finding.severity === 'high') {
    return {
      matched: false,
      reason: `Waivers cannot suppress ${finding.severity} severity findings. High/critical findings must be resolved.`,
    };
  }

  // Reason check
  if (config.waivers.requireReason && (!waiver.reason || !waiver.reason.trim())) {
    return {
      matched: false,
      reason: 'Waiver rejected: requireReason is enabled but waiver has no documented reason.',
    };
  }

  // Expiry check
  if (config.waivers.allowExpiry && waiver.expiresAt) {
    const expiryTime = new Date(waiver.expiresAt).getTime();
    if (isNaN(expiryTime) || expiryTime <= now.getTime()) {
      return {
        matched: false,
        reason: `Waiver '${waiver.id}' expired on ${waiver.expiresAt}.`,
      };
    }
  }

  // Finding ID match
  if (waiver.findingId && waiver.findingId === finding.id) {
    return { matched: true };
  }

  // Scoped rule match
  if (waiver.ruleId && waiver.ruleId === finding.ruleId) {
    if (waiver.route && waiver.route !== finding.route) {
      return { matched: false, reason: 'Route does not match waiver scope.' };
    }
    if (waiver.viewportWidth && waiver.viewportWidth !== finding.viewport.width) {
      return { matched: false, reason: 'Viewport width does not match waiver scope.' };
    }
    return { matched: true };
  }

  return { matched: false };
}

export function evaluatePolicy(options: EvaluatePolicyOptions): PolicyEvaluationResult {
  const { findings, config, waivers = [], scanId, now = new Date() } = options;

  const severityCounts: Record<SeverityLevel, number> = {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
    informational: 0,
  };

  const evaluations: FindingEvaluation[] = [];
  let blockedCount = 0;
  let waivedCount = 0;
  let allowedCount = 0;

  for (const finding of findings) {
    severityCounts[finding.severity]++;

    const baseAction = config.severity[finding.severity] ?? 'block';

    let waived = false;
    let matchingWaiverId: string | undefined;
    const reasons: string[] = [];

    if (baseAction === 'require-waiver') {
      // Look for a valid matching waiver
      for (const w of waivers) {
        const matchResult = evaluateWaiverMatch(w, finding, config, now);
        if (matchResult.matched) {
          waived = true;
          matchingWaiverId = w.id;
          finding.status = 'waived';
          break;
        } else if (matchResult.reason) {
          reasons.push(matchResult.reason);
        }
      }

      if (waived) {
        waivedCount++;
      } else {
        blockedCount++;
        reasons.push('Requires a documented, scoped waiver to proceed.');
      }
    } else if (baseAction === 'block') {
      blockedCount++;
      reasons.push(`Finding severity '${finding.severity}' is configured to block commits.`);
    } else {
      allowedCount++;
    }

    evaluations.push({
      finding,
      action: baseAction,
      waived,
      waiverId: matchingWaiverId,
      reasons,
    });
  }

  const decision = blockedCount > 0 ? 'block' : 'pass';
  const summary =
    decision === 'block'
      ? `Scan blocked: ${blockedCount} blocking finding(s) detected.`
      : `Scan passed: ${evaluations.length} total findings (${waivedCount} waived, ${allowedCount} allowed).`;

  return {
    scanId,
    decision,
    blockedCount,
    waivedCount,
    allowedCount,
    findings: evaluations,
    summary,
    severityCounts,
  };
}
