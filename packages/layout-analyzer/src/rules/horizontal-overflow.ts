import type { Finding, FindingEvidence, ViewportDimensions } from '@pixelbreak/contracts';

export interface OverflowElementInfo {
  selector: string;
  tagName: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    right: number;
    bottom: number;
  };
  scrollWidth: number;
  clientWidth: number;
  computedStyles: Record<string, string>;
  overflowAmount: number;
}

export function generateCssSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  const classNames = Array.from(element.classList).filter((c) => !c.startsWith('ng-') && !c.startsWith('v-'));
  if (classNames.length > 0) {
    const parent = element.parentElement;
    const baseSelector = `${element.tagName.toLowerCase()}.${classNames.join('.')}`;
    if (parent && parent.querySelectorAll(`.${classNames.join('.')}`).length === 1) {
      return baseSelector;
    }
  }

  // Fallback to path
  const path: string[] = [];
  let current: Element | null = element;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = `#${current.id}`;
      path.unshift(selector);
      break;
    } else if (current.className && typeof current.className === 'string' && current.className.trim()) {
      const firstClass = current.className.trim().split(/\s+/)[0];
      selector += `.${firstClass}`;
    }
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter((c) => c.tagName === current?.tagName);
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    path.unshift(selector);
    current = parent;
  }
  return path.join(' > ') || element.tagName.toLowerCase();
}

/**
 * Browser-injected function to detect horizontal overflow
 * Runs inside page.evaluate()
 */
export function inPageDetectHorizontalOverflow(viewport?: { width: number; height: number }): OverflowElementInfo[] {
  const doc = document.documentElement;
  const body = document.body;
  const viewportWidth = viewport?.width ?? window.innerWidth;
  const docScrollWidth = Math.max(doc.scrollWidth, body ? body.scrollWidth : 0);

  // If document does not horizontally overflow viewport, return empty
  if (docScrollWidth <= viewportWidth + 1) {
    return [];
  }

  const offendingElements: OverflowElementInfo[] = [];
  const allElements = document.querySelectorAll('*');

  allElements.forEach((el) => {
    if (el === doc || el === body || el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || el.tagName === 'SVG' || el.tagName === 'PATH') {
      return;
    }

    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return;
    }

    const rect = el.getBoundingClientRect();
    const rightOverflow = rect.right - viewportWidth;
    const isWiderThanViewport = rect.width > viewportWidth;
    const isScrollOverflowing = el.scrollWidth > el.clientWidth && el.scrollWidth > viewportWidth;

    if (rightOverflow > 1 || isWiderThanViewport || isScrollOverflowing) {
      // Find the most specific selector
      let selector = '';
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.classList.length > 0) {
        selector = `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}`;
      } else {
        selector = el.tagName.toLowerCase();
      }

      offendingElements.push({
        selector,
        tagName: el.tagName.toLowerCase(),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          right: Math.round(rect.right),
          bottom: Math.round(rect.bottom),
        },
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        computedStyles: {
          display: style.display,
          position: style.position,
          width: style.width,
          minWidth: style.minWidth,
          maxWidth: style.maxWidth,
          overflow: style.overflow,
          overflowX: style.overflowX,
          boxSizing: style.boxSizing,
        },
        overflowAmount: Math.round(Math.max(rightOverflow, rect.width - viewportWidth)),
      });
    }
  });

  // Sort by overflow amount descending (highest offending first)
  offendingElements.sort((a, b) => b.overflowAmount - a.overflowAmount);

  return offendingElements;
}

export function createHorizontalOverflowFindings(
  overflows: OverflowElementInfo[],
  options: {
    scanId: string;
    toolVersion: string;
    route: string;
    viewport: ViewportDimensions;
  }
): Finding[] {
  if (overflows.length === 0) {
    return [];
  }

  // Group or identify the primary offending elements
  // The primary finding captures the worst offender, and lists other offenders in evidence
  const worstOffender = overflows[0];
  const severity = worstOffender.overflowAmount >= 20 ? 'high' : 'moderate';

  const evidence: FindingEvidence = {
    description: `Horizontal document overflow: ${worstOffender.selector} extends by ${worstOffender.overflowAmount}px beyond viewport width (${options.viewport.width}px).`,
    measuredGeometry: {
      x: worstOffender.rect.x,
      y: worstOffender.rect.y,
      width: worstOffender.rect.width,
      height: worstOffender.rect.height,
      scrollWidth: worstOffender.scrollWidth,
      clientWidth: worstOffender.clientWidth,
    },
    viewportGeometry: options.viewport,
    computedStyles: worstOffender.computedStyles,
    overflowAmount: worstOffender.overflowAmount,
    additionalOffenders: overflows.slice(1, 5).map((o) => ({
      selector: o.selector,
      overflowAmount: o.overflowAmount,
      rect: o.rect,
    })),
  };

  const primaryFinding: Finding = {
    id: `finding-${options.scanId}-${options.viewport.width}-horizontal-overflow`,
    scanId: options.scanId,
    toolVersion: options.toolVersion,
    timestamp: new Date().toISOString(),
    ruleId: 'horizontal-overflow',
    severity,
    category: 'layout',
    route: options.route,
    viewport: options.viewport,
    selector: worstOffender.selector,
    summary: `Horizontal overflow detected: element '${worstOffender.selector}' exceeds viewport width of ${options.viewport.width}px by ${worstOffender.overflowAmount}px.`,
    evidence,
    status: 'open',
  };

  return [primaryFinding];
}
