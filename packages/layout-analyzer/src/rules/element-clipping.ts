import type { Finding, FindingEvidence, ViewportDimensions } from '@pixelbreak/contracts';

export interface ClippedElementInfo {
  selector: string;
  tagName: string;
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
  clippedWidth: number;
  clippedHeight: number;
  computedStyles: Record<string, string>;
}

export function inPageDetectElementClipping(): ClippedElementInfo[] {
  const clipped: ClippedElementInfo[] = [];
  const candidates = document.querySelectorAll('div, section, article, p, h1, h2, h3, h4, h5, h6, button, a, table, li');

  candidates.forEach((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') {
      return;
    }

    const isClipX = style.overflowX === 'hidden' || style.overflowX === 'clip';
    const isClipY = style.overflowY === 'hidden' || style.overflowY === 'clip';

    const widthDiff = el.scrollWidth - el.clientWidth;
    const heightDiff = el.scrollHeight - el.clientHeight;

    const hasHorizontalClipping = isClipX && widthDiff > 10;
    const hasVerticalClipping = isClipY && heightDiff > 10;

    if (hasHorizontalClipping || hasVerticalClipping) {
      const rect = el.getBoundingClientRect();
      let selector = '';
      if (el.id) {
        selector = `#${el.id}`;
      } else if (el.classList.length > 0) {
        selector = `${el.tagName.toLowerCase()}.${Array.from(el.classList).join('.')}`;
      } else {
        selector = el.tagName.toLowerCase();
      }

      clipped.push({
        selector,
        tagName: el.tagName.toLowerCase(),
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        scrollWidth: el.scrollWidth,
        scrollHeight: el.scrollHeight,
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight,
        clippedWidth: Math.max(0, widthDiff),
        clippedHeight: Math.max(0, heightDiff),
        computedStyles: {
          overflow: style.overflow,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          whiteSpace: style.whiteSpace,
          textOverflow: style.textOverflow,
          display: style.display,
        },
      });
    }
  });

  return clipped;
}

export function createElementClippingFindings(
  clippedElements: ClippedElementInfo[],
  options: {
    scanId: string;
    toolVersion: string;
    route: string;
    viewport: ViewportDimensions;
  }
): Finding[] {
  return clippedElements.slice(0, 3).map((item, idx) => {
    const isMajor = item.clippedWidth > 50 || item.clippedHeight > 50;
    const severity = isMajor ? 'high' : 'moderate';

    const evidence: FindingEvidence = {
      description: `Element content clipped: '${item.selector}' clips content (${item.clippedWidth}px horizontal, ${item.clippedHeight}px vertical).`,
      measuredGeometry: {
        x: item.rect.x,
        y: item.rect.y,
        width: item.rect.width,
        height: item.rect.height,
        scrollWidth: item.scrollWidth,
        scrollHeight: item.scrollHeight,
        clientWidth: item.clientWidth,
        clientHeight: item.clientHeight,
      },
      viewportGeometry: options.viewport,
      computedStyles: item.computedStyles,
    };

    return {
      id: `finding-${options.scanId}-${options.viewport.width}-clipping-${idx}`,
      scanId: options.scanId,
      toolVersion: options.toolVersion,
      timestamp: new Date().toISOString(),
      ruleId: 'element-clipping',
      severity,
      category: 'layout',
      route: options.route,
      viewport: options.viewport,
      selector: item.selector,
      summary: `Element clipping detected: '${item.selector}' has hidden overflow clipping content.`,
      evidence,
      status: 'open',
    };
  });
}
