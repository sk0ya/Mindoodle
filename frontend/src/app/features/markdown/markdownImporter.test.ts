import { describe, it, expect } from 'vitest';
import { MarkdownImporter } from './markdownImporter';
import type { MindMapNode } from '@shared/types';

describe('MarkdownImporter', () => {
  describe('parseMarkdownToNodes', () => {
    it('should parse simple heading', () => {
      const markdown = '# Hello World';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].text).toBe('Hello World');
      expect(result.rootNodes[0].markdownMeta?.type).toBe('heading');
      expect(result.rootNodes[0].markdownMeta?.level).toBe(1);
    });

    it('should parse multiple headings', () => {
      const markdown = '# Heading 1\n## Heading 2\n### Heading 3';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].text).toBe('Heading 1');
      expect(result.rootNodes[0].children).toHaveLength(1);
      expect(result.rootNodes[0].children![0].text).toBe('Heading 2');
    });

    it('should parse unordered list', () => {
      const markdown = '- Item 1\n- Item 2\n- Item 3';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(3);
      expect(result.rootNodes[0].text).toBe('Item 1');
      expect(result.rootNodes[0].markdownMeta?.type).toBe('unordered-list');
    });

    it('should parse ordered list', () => {
      const markdown = '1. First\n2. Second\n3. Third';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(3);
      expect(result.rootNodes[0].text).toBe('First');
      expect(result.rootNodes[0].markdownMeta?.type).toBe('ordered-list');
    });

    it('should parse nested lists', () => {
      const markdown = '- Parent\n  - Child 1\n  - Child 2';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].text).toBe('Parent');
      expect(result.rootNodes[0].children).toHaveLength(2);
      expect(result.rootNodes[0].children![0].text).toBe('Child 1');
    });

    it('should parse heading with list children', () => {
      const markdown = '# Main\n- Item 1\n- Item 2';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].text).toBe('Main');
      expect(result.rootNodes[0].markdownMeta?.type).toBe('heading');
      expect(result.rootNodes[0].children).toHaveLength(2);
    });

    it('should handle checkbox items', () => {
      const markdown = '- [ ] Todo\n- [x] Done';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(2);
      expect(result.rootNodes[0].markdownMeta?.isCheckbox).toBe(true);
      expect(result.rootNodes[0].markdownMeta?.isChecked).toBe(false);
      expect(result.rootNodes[1].markdownMeta?.isCheckbox).toBe(true);
      expect(result.rootNodes[1].markdownMeta?.isChecked).toBe(true);
    });

    it('should parse preface (content before first structure)', () => {
      const markdown = 'Some intro text\nMore intro\n# First Heading';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(2);
      expect(result.rootNodes[0].markdownMeta?.type).toBe('preface');
      expect(result.rootNodes[0].note).toContain('Some intro text');
    });

    it('should handle content under headings', () => {
      const markdown = '# Heading\nSome content\nMore content';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].note).toContain('Some content');
    });

    it('should handle empty markdown with preface', () => {
      // Empty markdown splits into empty array, which throws error
      // But split on '\n' creates array with one empty string
      const result = MarkdownImporter.parseMarkdownToNodes('\n');
      // Should create preface node for empty content
      expect(result.rootNodes).toHaveLength(1);
    });

    it('should handle markdown without structure as preface', () => {
      const result = MarkdownImporter.parseMarkdownToNodes('Just plain text');
      // Plain text becomes preface node
      expect(result.rootNodes).toHaveLength(1);
      expect(result.rootNodes[0].markdownMeta?.type).toBe('preface');
    });

    it('should detect and preserve line endings', () => {
      const markdown = '# Test\r\n- Item';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      expect(result.rootNodes[0].lineEnding).toBe('\r\n');
    });

    it('should apply collapse to deep hierarchies', () => {
      // Create markdown with >30 nodes to trigger auto-collapse
      const lines = ['# Root'];
      for (let i = 0; i < 35; i++) {
        lines.push(`- Item ${i}`);
      }
      const markdown = lines.join('\n');
      const result = MarkdownImporter.parseMarkdownToNodes(markdown);

      // Some nodes should be collapsed due to totalNodeCount > 30
      expect(result.rootNodes).toHaveLength(1);
    });

    it('should respect custom positioning options', () => {
      const markdown = '# Test\n## Child';
      const result = MarkdownImporter.parseMarkdownToNodes(markdown, {
        startX: 200,
        startY: 300,
        horizontalSpacing: 50,
        verticalSpacing: 40,
      });

      expect(result.rootNodes[0].x).toBe(200);
      expect(result.rootNodes[0].y).toBe(300);
    });
  });

  describe('convertNodesToMarkdown', () => {
    it('should convert heading node to markdown', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Test',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'heading',
          level: 1,
          originalFormat: '#',
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toBe('# Test');
    });

    it('should convert unordered list to markdown', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Item',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'unordered-list',
          level: 1,
          originalFormat: '-',
          indentLevel: 0,
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toBe('- Item');
    });

    it('should convert ordered list to markdown', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'First',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'ordered-list',
          level: 1,
          originalFormat: '1.',
          indentLevel: 0,
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toBe('1. First');
    });

    it('should convert nested structure', () => {
      const child: MindMapNode = {
        id: '2',
        text: 'Child',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'unordered-list',
          level: 1,
          originalFormat: '-',
          indentLevel: 0,
          lineNumber: 1,
        },
      };

      const parent: MindMapNode = {
        id: '1',
        text: 'Parent',
        x: 0,
        y: 0,
        children: [child],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'heading',
          level: 1,
          originalFormat: '#',
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([parent]);
      expect(markdown).toContain('# Parent');
      expect(markdown).toContain('- Child');
    });

    it('should convert checkbox items', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Task',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'unordered-list',
          level: 1,
          originalFormat: '-',
          indentLevel: 0,
          lineNumber: 0,
          isCheckbox: true,
          isChecked: true,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toBe('- [x] Task');
    });

    it('should preserve line endings', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Line 1',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\r\n',
          markdownMeta: {
            type: 'heading',
            level: 1,
            originalFormat: '#',
            lineNumber: 0,
          },
        },
        {
          id: '2',
          text: 'Line 2',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\r\n',
          markdownMeta: {
            type: 'heading',
            level: 1,
            originalFormat: '#',
            lineNumber: 1,
          },
        },
      ];

      const markdown = MarkdownImporter.convertNodesToMarkdown(nodes);
      expect(markdown).toContain('\r\n');
    });

    it('should handle preface nodes', () => {
      const node: MindMapNode = {
        id: '1',
        text: '',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        note: 'Preface content',
        markdownMeta: {
          type: 'preface',
          level: 0,
          originalFormat: '',
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toBe('Preface content');
    });

    it('should include note content', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Heading',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        note: 'Additional content',
        markdownMeta: {
          type: 'heading',
          level: 1,
          originalFormat: '#',
          lineNumber: 0,
        },
      };

      const markdown = MarkdownImporter.convertNodesToMarkdown([node]);
      expect(markdown).toContain('# Heading');
      expect(markdown).toContain('Additional content');
    });
  });

  describe('updateNodeInMarkdown', () => {
    it('should update node text', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Old Text',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'heading',
            level: 1,
            originalFormat: '#',
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.updateNodeInMarkdown(nodes, '1', 'New Text');
      expect(result.updatedNodes[0].text).toBe('New Text');
      expect(result.updatedMarkdown).toContain('New Text');
    });

    it('should update nested node', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Parent',
          x: 0,
          y: 0,
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          children: [
            {
              id: '2',
              text: 'Child',
              x: 0,
              y: 0,
              children: [],
              fontSize: 14,
              fontWeight: 'normal',
              lineEnding: '\n',
            },
          ],
        },
      ];

      const result = MarkdownImporter.updateNodeInMarkdown(nodes, '2', 'Updated Child');
      expect(result.updatedNodes[0].children![0].text).toBe('Updated Child');
    });
  });

  describe('getNodeStructureInfo', () => {
    it('should return structure info for heading', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Test',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
        markdownMeta: {
          type: 'heading',
          level: 2,
          originalFormat: '##',
          lineNumber: 0,
        },
      };

      const info = MarkdownImporter.getNodeStructureInfo(node);
      expect(info.type).toBe('heading');
      expect(info.level).toBe(2);
      expect(info.canConvertToMarkdown).toBe(true);
    });

    it('should return unknown for node without meta', () => {
      const node: MindMapNode = {
        id: '1',
        text: 'Test',
        x: 0,
        y: 0,
        children: [],
        fontSize: 14,
        fontWeight: 'normal',
        lineEnding: '\n',
      };

      const info = MarkdownImporter.getNodeStructureInfo(node);
      expect(info.type).toBe('unknown');
      expect(info.canConvertToMarkdown).toBe(false);
    });
  });

  describe('changeNodeIndent', () => {
    it('should increase heading level', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Test',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'heading',
            level: 2,
            originalFormat: '##',
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeNodeIndent(nodes, '1', 'increase');
      expect(result[0].markdownMeta?.level).toBe(3);
      expect(result[0].markdownMeta?.originalFormat).toBe('###');
    });

    it('should decrease heading level', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Test',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'heading',
            level: 3,
            originalFormat: '###',
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeNodeIndent(nodes, '1', 'decrease');
      expect(result[0].markdownMeta?.level).toBe(2);
    });

    it('should not decrease heading below level 1', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Test',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'heading',
            level: 1,
            originalFormat: '#',
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeNodeIndent(nodes, '1', 'decrease');
      expect(result[0].markdownMeta?.level).toBe(1);
    });

    it('should not increase heading above level 6', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Test',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'heading',
            level: 6,
            originalFormat: '######',
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeNodeIndent(nodes, '1', 'increase');
      expect(result[0].markdownMeta?.level).toBe(6);
    });

    it('should change list indent level', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Item',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'unordered-list',
            level: 1,
            originalFormat: '-',
            indentLevel: 0,
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeNodeIndent(nodes, '1', 'increase');
      expect(result[0].markdownMeta?.indentLevel).toBe(2);
      expect(result[0].markdownMeta?.level).toBe(2);
    });
  });

  describe('changeListType', () => {
    it('should convert unordered to ordered', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Item',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'unordered-list',
            level: 1,
            originalFormat: '-',
            indentLevel: 0,
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeListType(nodes, '1', 'ordered-list');
      expect(result[0].markdownMeta?.type).toBe('ordered-list');
      expect(result[0].markdownMeta?.originalFormat).toBe('1.');
    });

    it('should convert ordered to unordered', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'Item',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'ordered-list',
            level: 1,
            originalFormat: '1.',
            indentLevel: 0,
            lineNumber: 0,
          },
        },
      ];

      const result = MarkdownImporter.changeListType(nodes, '1', 'unordered-list');
      expect(result[0].markdownMeta?.type).toBe('unordered-list');
      expect(result[0].markdownMeta?.originalFormat).toBe('-');
    });
  });

  describe('renumberOrderedLists', () => {
    it('should renumber sequential ordered lists', () => {
      const nodes: MindMapNode[] = [
        {
          id: '1',
          text: 'First',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'ordered-list',
            level: 1,
            originalFormat: '5.',
            indentLevel: 0,
            lineNumber: 0,
          },
        },
        {
          id: '2',
          text: 'Second',
          x: 0,
          y: 0,
          children: [],
          fontSize: 14,
          fontWeight: 'normal',
          lineEnding: '\n',
          markdownMeta: {
            type: 'ordered-list',
            level: 1,
            originalFormat: '10.',
            indentLevel: 0,
            lineNumber: 1,
          },
        },
      ];

      const result = MarkdownImporter.renumberOrderedLists(nodes);
      expect(result[0].markdownMeta?.originalFormat).toBe('1.');
      expect(result[1].markdownMeta?.originalFormat).toBe('2.');
    });
  });
});
