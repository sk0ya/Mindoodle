import { describe, it, expect, beforeEach } from 'vitest';
import {
  nodeToMarkdownTree,
  nodeToIndentedText,
  getLastCopiedHash,
  setLastCopiedHash,
} from './NodeClipboardService';
import { createTestNode as createNode } from '../test-helpers/testNodeFactory';

describe('NodeClipboardService', () => {
  describe('nodeToMarkdownTree', () => {
    it('should convert single node to markdown', () => {
      const node = createNode({ text: 'Hello World' });
      const result = nodeToMarkdownTree(node);

      expect(result).toBe('# Hello World\n');
    });

    it('should convert node with note', () => {
      const node = createNode({
        text: 'Title',
        note: 'This is a note',
      });
      const result = nodeToMarkdownTree(node);

      expect(result).toBe('# Title\nThis is a note\n');
    });

    it('should convert nested nodes with proper heading levels', () => {
      const grandchild = createNode({
        id: 'grandchild',
        text: 'Level 3',
      });

      const child = createNode({
        id: 'child',
        text: 'Level 2',
        children: [grandchild],
      });

      const root = createNode({
        id: 'root',
        text: 'Level 1',
        children: [child],
      });

      const result = nodeToMarkdownTree(root, 0);

      expect(result).toContain('# Level 1');
      expect(result).toContain('## Level 2');
      expect(result).toContain('### Level 3');
    });

    it('should limit heading levels to 6', () => {
      let node = createNode({ text: 'Deep' });

      // Create 10 levels deep
      for (let i = 0; i < 10; i++) {
        node = createNode({
          text: `Level ${i}`,
          children: [node],
        });
      }

      const result = nodeToMarkdownTree(node, 0);

      // Count number of # symbols in first heading (should max at 6)
      const firstHeading = result.split('\n')[0];
      const hashCount = (firstHeading.match(/#/g) || []).length;
      expect(hashCount).toBeLessThanOrEqual(6);
    });
  });

  describe('nodeToIndentedText', () => {
    it('should convert node to indented text', () => {
      const node = createNode({ text: 'Hello World' });
      const result = nodeToIndentedText(node);

      expect(result).toBe('Hello World\n');
    });

    it('should remove heading markers', () => {
      const node = createNode({ text: '## Hello World' });
      const result = nodeToIndentedText(node);

      expect(result).toBe('Hello World\n');
    });

    it('should handle unordered list items', () => {
      const node = createNode({
        text: 'List Item',
        markdownMeta: {
          type: 'unordered-list',
          isCheckbox: false,
        },
      });

      const result = nodeToIndentedText(node);
      expect(result).toBe('- List Item\n');
    });

    it('should handle checkbox items', () => {
      const unchecked = createNode({
        text: 'Unchecked',
        markdownMeta: {
          type: 'unordered-list',
          isCheckbox: true,
          isChecked: false,
        },
      });

      const checked = createNode({
        text: 'Checked',
        markdownMeta: {
          type: 'unordered-list',
          isCheckbox: true,
          isChecked: true,
        },
      });

      expect(nodeToIndentedText(unchecked)).toBe('- [ ] Unchecked\n');
      expect(nodeToIndentedText(checked)).toBe('- [x] Checked\n');
    });

    it('should handle ordered list items', () => {
      const node = createNode({
        text: 'Ordered Item',
        markdownMeta: {
          type: 'ordered-list',
        },
      });

      const result = nodeToIndentedText(node);
      expect(result).toBe('1. Ordered Item\n');
    });

    it('should indent nested children', () => {
      const child2 = createNode({
        id: 'child2',
        text: 'Child 2',
      });

      const child1 = createNode({
        id: 'child1',
        text: 'Child 1',
        children: [child2],
      });

      const root = createNode({
        id: 'root',
        text: 'Root',
        children: [child1],
      });

      const result = nodeToIndentedText(root);

      expect(result).toContain('Root\n');
      expect(result).toContain('  Child 1\n');
      expect(result).toContain('    Child 2\n');
    });
  });

  describe('hash state management', () => {
    beforeEach(() => {
      setLastCopiedHash(null);
    });

    it('should get and set last copied hash', () => {
      expect(getLastCopiedHash()).toBeNull();

      setLastCopiedHash('test-hash-123');
      expect(getLastCopiedHash()).toBe('test-hash-123');
    });

    it('should allow clearing hash', () => {
      setLastCopiedHash('test-hash-123');
      setLastCopiedHash(null);

      expect(getLastCopiedHash()).toBeNull();
    });
  });
});
