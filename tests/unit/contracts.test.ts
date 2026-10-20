import { describe, it, expect } from 'vitest';
import type { Finding, PixelBreakConfig } from '@pixelbreak/contracts';

describe('@pixelbreak/contracts', () => {
  it('validates contract types can be typed and constructed', () => {
    const finding: Finding = {
      id: 'find-1024-overflow',
      scanId: 'scan-1',
      toolVersion: '0.1.0',
      timestamp: new Date().toISOString(),
      ruleId: 'horizontal-overflow',
      severity: 'high',
      category: 'layout',
      route: '/',
      viewport: { width: 1024, height: 900 },
      selector: '.metrics-container',
      summary: 'Horizontal overflow detected (scrollWidth: 1264px exceeds viewport width: 1024px)',
      evidence: {
        description: 'Element width exceeds viewport',
        measuredGeometry: {
          x: 32,
          y: 120,
          width: 1200,
          height: 100,
          scrollWidth: 1264,
        },
      },
      status: 'open',
    };

    expect(finding.severity).toBe('high');
    expect(finding.category).toBe('layout');
    expect(finding.status).toBe('open');
  });
});
