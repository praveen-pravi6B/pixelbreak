import { describe, it, expect } from 'vitest';
import {
  createHorizontalOverflowFindings,
  type OverflowElementInfo,
} from '../src/rules/horizontal-overflow.js';
import {
  createElementClippingFindings,
  type ClippedElementInfo,
} from '../src/rules/element-clipping.js';

describe('@pixelbreak/layout-analyzer', () => {
  it('creates horizontal overflow finding with high severity for major overflow', () => {
    const overflows: OverflowElementInfo[] = [
      {
        selector: '.metrics-container',
        tagName: 'div',
        rect: { x: 32, y: 120, width: 1200, height: 100, right: 1232, bottom: 220 },
        scrollWidth: 1200,
        clientWidth: 1200,
        computedStyles: { minWidth: '1200px', display: 'flex' },
        overflowAmount: 208, // 1232 - 1024 = 208px
      },
    ];

    const findings = createHorizontalOverflowFindings(overflows, {
      scanId: 'scan-test',
      toolVersion: '0.1.0',
      route: '/',
      viewport: { width: 1024, height: 900 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('horizontal-overflow');
    expect(findings[0].severity).toBe('high');
    expect(findings[0].selector).toBe('.metrics-container');
    expect(findings[0].evidence.overflowAmount).toBe(208);
  });

  it('creates moderate severity horizontal overflow finding for small overflow', () => {
    const overflows: OverflowElementInfo[] = [
      {
        selector: '.card',
        tagName: 'div',
        rect: { x: 0, y: 0, width: 1030, height: 100, right: 1030, bottom: 100 },
        scrollWidth: 1030,
        clientWidth: 1030,
        computedStyles: {},
        overflowAmount: 6, // 6px overflow
      },
    ];

    const findings = createHorizontalOverflowFindings(overflows, {
      scanId: 'scan-test',
      toolVersion: '0.1.0',
      route: '/',
      viewport: { width: 1024, height: 900 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].severity).toBe('moderate');
  });

  it('creates element clipping findings', () => {
    const clipped: ClippedElementInfo[] = [
      {
        selector: '.truncate-box',
        tagName: 'div',
        rect: { x: 10, y: 10, width: 200, height: 40 },
        scrollWidth: 320,
        scrollHeight: 40,
        clientWidth: 200,
        clientHeight: 40,
        clippedWidth: 120,
        clippedHeight: 0,
        computedStyles: { overflowX: 'hidden' },
      },
    ];

    const findings = createElementClippingFindings(clipped, {
      scanId: 'scan-test',
      toolVersion: '0.1.0',
      route: '/',
      viewport: { width: 1024, height: 900 },
    });

    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('element-clipping');
    expect(findings[0].severity).toBe('high');
  });
});
