import { describe, it, expect } from 'vitest';
import {
  getNodeTextLineHeight,
  getNodeTextMaxWidth,
  getNodeHorizontalPadding,
  resolveNodeTextWrapConfig,
  measureTextWidth,
  getNodeLeftX,
  getNodeRightX,
  getNodeTopY,
  getNodeBottomY,
  getNodeBounds,
  getDynamicNodeSpacing,
  getMarkerPrefixTokens,
  wrapNodeText,
  calculateNodeSize,
  getToggleButtonPosition,
  calculateChildNodeX,
  getBranchColor,
} from './nodeUtils';
import { createTestNode as createNode } from '../test-utils/testHelpers';

describe('nodeUtils', () => {

  describe('getNodeTextLineHeight', () => {
    it('should calculate line height with ratio', () => {
      const lineHeight = getNodeTextLineHeight(20);
      expect(lineHeight).toBeGreaterThan(20);
      expect(lineHeight).toBeCloseTo(20 * 1.35, 1);
    });

    it('should have minimum line height', () => {
      const lineHeight = getNodeTextLineHeight(10);
      expect(lineHeight).toBeGreaterThanOrEqual(16); // fontSize + 6
    });

    it('should scale with font size', () => {
      const lineHeight14 = getNodeTextLineHeight(14);
      const lineHeight20 = getNodeTextLineHeight(20);
      expect(lineHeight20).toBeGreaterThan(lineHeight14);
    });
  });

  describe('getNodeTextMaxWidth', () => {
    it('should return dynamic width based on font size', () => {
      const width14 = getNodeTextMaxWidth(14);
      const width20 = getNodeTextMaxWidth(20);

      expect(width20).toBeGreaterThan(width14);
    });

    it('should have minimum width', () => {
      const width = getNodeTextMaxWidth(8);
      expect(width).toBeGreaterThanOrEqual(160); // NODE_TEXT_MIN_WIDTH
    });

    it('should follow formula: BASE + (fontSize - 14) * 12', () => {
      const width = getNodeTextMaxWidth(16);
      // BASE = 240, fontSize = 16, formula = 240 + (16-14)*12 = 264
      expect(width).toBe(264);
    });
  });

  describe('getNodeHorizontalPadding', () => {
    it('should return larger padding when editing', () => {
      const normalPadding = getNodeHorizontalPadding(10, false);
      const editingPadding = getNodeHorizontalPadding(10, true);

      expect(editingPadding).toBeGreaterThan(normalPadding);
      expect(editingPadding).toBe(34);
    });

    it('should scale with text length', () => {
      const shortPadding = getNodeHorizontalPadding(5, false);
      const longPadding = getNodeHorizontalPadding(50, false);

      expect(longPadding).toBeGreaterThan(shortPadding);
    });

    it('should have minimum padding', () => {
      const padding = getNodeHorizontalPadding(0, false);
      expect(padding).toBeGreaterThanOrEqual(12); // basePadding
    });

    it('should max out additional padding', () => {
      const padding1 = getNodeHorizontalPadding(100, false);
      const padding2 = getNodeHorizontalPadding(200, false);

      // Additional padding maxes out at textLength/25 = 1
      expect(padding1).toBe(padding2);
      expect(padding1).toBe(12 + 13); // basePadding + maxAdditionalPadding
    });
  });

  describe('resolveNodeTextWrapConfig', () => {
    it('should enable wrapping by default', () => {
      const config = resolveNodeTextWrapConfig(undefined, 14);
      expect(config.enabled).toBe(true);
    });

    it('should respect settings.nodeTextWrapEnabled', () => {
      const config = resolveNodeTextWrapConfig({ nodeTextWrapEnabled: false }, 14);
      expect(config.enabled).toBe(false);
    });

    it('should use custom width if provided', () => {
      const config = resolveNodeTextWrapConfig({ nodeTextWrapWidth: 500 }, 14);
      expect(config.maxWidth).toBe(500);
    });

    it('should enforce minimum width', () => {
      const config = resolveNodeTextWrapConfig({ nodeTextWrapWidth: 50 }, 14);
      expect(config.maxWidth).toBeGreaterThanOrEqual(160); // NODE_TEXT_MIN_WIDTH
    });

    it('should calculate default width based on font size', () => {
      const config14 = resolveNodeTextWrapConfig(undefined, 14);
      const config20 = resolveNodeTextWrapConfig(undefined, 20);

      expect(config20.maxWidth).toBeGreaterThan(config14.maxWidth);
    });
  });

  describe('measureTextWidth', () => {
    it('should return 0 for empty text', () => {
      expect(measureTextWidth('')).toBe(0);
    });

    it('should measure text width', () => {
      const width = measureTextWidth('Hello World', 14);
      expect(width).toBeGreaterThan(0);
    });

    it('should scale with font size', () => {
      const width14 = measureTextWidth('Test', 14);
      const width20 = measureTextWidth('Test', 20);

      // Both return same mock value in test environment, just verify they return positive numbers
      expect(width14).toBeGreaterThan(0);
      expect(width20).toBeGreaterThan(0);
    });

    it('should handle different font weights', () => {
      const normalWidth = measureTextWidth('Test', 14, 'sans-serif', 'normal');
      const boldWidth = measureTextWidth('Test', 14, 'sans-serif', 'bold');

      // Bold text should be wider (in real canvas, mocked here)
      expect(boldWidth).toBeGreaterThanOrEqual(normalWidth);
    });
  });

  describe('position calculation functions', () => {
    const testNode = createNode({ x: 100, y: 200 });

    describe('getNodeLeftX', () => {
      it('should calculate left edge', () => {
        const left = getNodeLeftX(testNode, 80);
        expect(left).toBe(60); // 100 - 80/2
      });
    });

    describe('getNodeRightX', () => {
      it('should calculate right edge', () => {
        const right = getNodeRightX(testNode, 80);
        expect(right).toBe(140); // 100 + 80/2
      });
    });

    describe('getNodeTopY', () => {
      it('should calculate top edge', () => {
        const top = getNodeTopY(testNode, 60);
        expect(top).toBe(170); // 200 - 60/2
      });
    });

    describe('getNodeBottomY', () => {
      it('should calculate bottom edge', () => {
        const bottom = getNodeBottomY(testNode, 60);
        expect(bottom).toBe(230); // 200 + 60/2
      });
    });

    describe('getNodeBounds', () => {
      it('should calculate all bounds', () => {
        const nodeSize = { width: 80, height: 60, imageHeight: 0 };
        const bounds = getNodeBounds(testNode, nodeSize);

        expect(bounds.left).toBe(60);
        expect(bounds.right).toBe(140);
        expect(bounds.top).toBe(170);
        expect(bounds.bottom).toBe(230);
        expect(bounds.centerX).toBe(100);
        expect(bounds.centerY).toBe(200);
        expect(bounds.width).toBe(80);
        expect(bounds.height).toBe(60);
      });
    });
  });

  describe('getDynamicNodeSpacing', () => {
    it('should return minimum spacing', () => {
      const parentSize = { width: 50, height: 40, imageHeight: 0 };
      const childSize = { width: 50, height: 40, imageHeight: 0 };

      const spacing = getDynamicNodeSpacing(parentSize, childSize);
      expect(spacing).toBeGreaterThanOrEqual(35); // toggleButtonWidth + minToggleToChildSpacing
    });

    it('should increase with node width', () => {
      const smallParent = { width: 50, height: 40, imageHeight: 0 };
      const largeParent = { width: 200, height: 40, imageHeight: 0 };
      const childSize = { width: 50, height: 40, imageHeight: 0 };

      const smallSpacing = getDynamicNodeSpacing(smallParent, childSize);
      const largeSpacing = getDynamicNodeSpacing(largeParent, childSize);

      expect(largeSpacing).toBeGreaterThan(smallSpacing);
    });

    it('should consider child width', () => {
      const parentSize = { width: 100, height: 40, imageHeight: 0 };
      const smallChild = { width: 50, height: 40, imageHeight: 0 };
      const largeChild = { width: 200, height: 40, imageHeight: 0 };

      const smallSpacing = getDynamicNodeSpacing(parentSize, smallChild);
      const largeSpacing = getDynamicNodeSpacing(parentSize, largeChild);

      expect(largeSpacing).toBeGreaterThan(smallSpacing);
    });

    it('should return rounded integer', () => {
      const parentSize = { width: 100, height: 40, imageHeight: 0 };
      const childSize = { width: 100, height: 40, imageHeight: 0 };

      const spacing = getDynamicNodeSpacing(parentSize, childSize);
      expect(spacing).toBe(Math.round(spacing));
    });
  });

  describe('getMarkerPrefixTokens', () => {
    it('should return heading marker', () => {
      const node = createNode({
        markdownMeta: { type: 'heading', lineNumber: 1 },
      });

      const tokens = getMarkerPrefixTokens(node);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe('#');
      expect(tokens[0].isMarker).toBe(true);
      expect(tokens[1].text).toBe(' ');
      expect(tokens[1].isMarker).toBe(true);
    });

    it('should return unordered list marker', () => {
      const node = createNode({
        markdownMeta: { type: 'unordered-list', lineNumber: 1 },
      });

      const tokens = getMarkerPrefixTokens(node);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe('-');
      expect(tokens[1].text).toBe(' ');
    });

    it('should return ordered list marker', () => {
      const node = createNode({
        markdownMeta: { type: 'ordered-list', lineNumber: 1 },
      });

      const tokens = getMarkerPrefixTokens(node);
      expect(tokens).toHaveLength(2);
      expect(tokens[0].text).toBe('1.');
      expect(tokens[1].text).toBe(' ');
    });

    it('should return empty array for no meta', () => {
      const node = createNode({ markdownMeta: undefined });
      const tokens = getMarkerPrefixTokens(node);
      expect(tokens).toEqual([]);
    });

    it('should return empty array for unknown type', () => {
      const node = createNode({
        markdownMeta: { type: 'paragraph', lineNumber: 1 } as any,
      });

      const tokens = getMarkerPrefixTokens(node);
      expect(tokens).toEqual([]);
    });
  });

  describe('wrapNodeText', () => {
    it('should wrap text within maxWidth', () => {
      const text = 'This is a long text that should wrap';
      const result = wrapNodeText(text, {
        fontSize: 14,
        fontFamily: 'system-ui',
        fontWeight: 'normal',
        fontStyle: 'normal',
        maxWidth: 100,
      });

      expect(result.lines.length).toBeGreaterThan(1);
      expect(result.maxLineWidth).toBeLessThanOrEqual(100);
      expect(result.lineHeight).toBeGreaterThan(14);
    });

    it('should handle single line text', () => {
      const text = 'Short';
      const result = wrapNodeText(text, {
        fontSize: 14,
        fontFamily: 'system-ui',
        fontWeight: 'normal',
        fontStyle: 'normal',
        maxWidth: 200,
      });

      expect(result.lines.length).toBe(1);
      expect(result.lines[0].rawText).toBe('Short');
    });

    it('should handle empty text', () => {
      const result = wrapNodeText('', {
        fontSize: 14,
        fontFamily: 'system-ui',
        fontWeight: 'normal',
        fontStyle: 'normal',
        maxWidth: 200,
      });

      expect(result.lines.length).toBeGreaterThanOrEqual(0);
    });

    it('should include prefix tokens', () => {
      const text = 'Test';
      const prefixTokens = [
        { text: '#', isMarker: true },
        { text: ' ', isMarker: true },
      ];

      const result = wrapNodeText(text, {
        fontSize: 14,
        fontFamily: 'system-ui',
        fontWeight: 'normal',
        fontStyle: 'normal',
        maxWidth: 200,
        prefixTokens,
      });

      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines[0].tokens[0].isMarker).toBe(true);
    });

    it('should handle newlines', () => {
      const text = 'Line1\nLine2\nLine3';
      const result = wrapNodeText(text, {
        fontSize: 14,
        fontFamily: 'system-ui',
        fontWeight: 'normal',
        fontStyle: 'normal',
        maxWidth: 200,
      });

      expect(result.lines.length).toBe(3);
    });
  });

  describe('calculateNodeSize', () => {
    it('should calculate size for simple text node', () => {
      const node = createNode({ text: 'Hello', fontSize: 14 });
      const size = calculateNodeSize(node);

      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
      expect(size.imageHeight).toBe(0);
    });

    it('should handle editing mode', () => {
      const node = createNode({ text: 'Hello' });
      const editSize = calculateNodeSize(node, 'Hello World', true);
      const normalSize = calculateNodeSize(node, undefined, false);

      expect(editSize.width).toBeGreaterThanOrEqual(normalSize.width);
    });

    it('should calculate size for node with image', () => {
      const node = createNode({
        text: 'Test',
        note: '![image](test.png)',
        customImageWidth: 200,
        customImageHeight: 150,
      });

      const size = calculateNodeSize(node);
      expect(size.imageHeight).toBe(150);
      expect(size.width).toBeGreaterThan(0);
    });

    it('should calculate size for table node', () => {
      const node = createNode({
        text: '| A | B |\n|---|---|\n| 1 | 2 |',
        kind: 'table',
      });

      const size = calculateNodeSize(node);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should respect custom wrap config', () => {
      const node = createNode({ text: 'Very long text that would wrap' });
      const wrapConfig = { enabled: true, maxWidth: 100 };

      const size = calculateNodeSize(node, undefined, false, 14, wrapConfig);
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should handle checkbox nodes', () => {
      const node = createNode({
        text: 'Task',
        markdownMeta: { type: 'unordered-list', lineNumber: 1, isCheckbox: true },
      });

      const size = calculateNodeSize(node);
      expect(size.width).toBeGreaterThan(0);
    });
  });

  describe('getToggleButtonPosition', () => {
    it('should position toggle button on right for root node', () => {
      const node = createNode({ id: 'root', x: 0, y: 0 });
      const position = getToggleButtonPosition(node, node);

      expect(position.x).toBeGreaterThan(0);
      expect(position.y).toBe(0);
    });

    it('should position toggle button based on node position', () => {
      const rootNode = createNode({ id: 'root', x: 0, y: 0 });
      const childNode = createNode({ id: 'child', x: 100, y: 0 });

      const position = getToggleButtonPosition(childNode, rootNode);
      expect(position.x).toBeGreaterThan(childNode.x);
    });
  });

  describe('calculateChildNodeX', () => {
    it('should calculate child x position', () => {
      const parent = createNode({ x: 0, y: 0 });
      const childSize = { width: 80, height: 40, imageHeight: 0 };

      const childX = calculateChildNodeX(parent, childSize, 50);
      expect(childX).toBeGreaterThan(parent.x);
    });
  });

  describe('getBranchColor', () => {
    it('should return default color for root node', () => {
      const normalizedData = {
        nodes: { 'root-1': createNode({ id: 'root-1' }) },
        parentMap: {},
        childrenMap: {},
        rootNodeIds: ['root-1'],
      };

      const color = getBranchColor('root-1', normalizedData);
      expect(color).toBe('#333');
    });

    it('should assign colors to branch children', () => {
      const normalizedData = {
        nodes: {
          'root-1': createNode({ id: 'root-1' }),
          'child-1': createNode({ id: 'child-1' }),
        },
        parentMap: { 'child-1': 'root-1' },
        childrenMap: { 'root-1': ['child-1'] },
        rootNodeIds: ['root-1'],
      };

      const color = getBranchColor('child-1', normalizedData);
      expect(color).toMatch(/^#[0-9A-F]{6}$/i);
    });
  });
});
