import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { MarkdownParser } from './MarkdownParser';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new MarkdownParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('canParse', () => {
    it('should return true for .md files', () => {
      expect(parser.canParse('/path/to/file.md')).toBe(true);
    });

    it('should return false for non-.md files', () => {
      expect(parser.canParse('/path/to/file.txt')).toBe(false);
      expect(parser.canParse('/path/to/file.pdf')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should strip markdown headers', async () => {
      const filePath = path.join(tempDir, 'headers.md');
      const markdown = '# Header 1\n## Header 2\n### Header 3\nPlain text';
      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Header 1\nHeader 2\nHeader 3\nPlain text');
      expect(content).not.toContain('#');
    });

    it('should remove bold and italic markers', async () => {
      const filePath = path.join(tempDir, 'formatting.md');
      const markdown = 'This is **bold** and this is *italic* and __also bold__ and _also italic_';
      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('This is bold and this is italic and also bold and also italic');
      expect(content).not.toContain('**');
      expect(content).not.toContain('__');
      expect(content).not.toMatch(/\*[^*]+\*/);
      expect(content).not.toMatch(/_[^_]+_/);
    });

    it('should convert links to plain text', async () => {
      const filePath = path.join(tempDir, 'links.md');
      const markdown = 'Check out [this link](https://example.com) and [another](https://test.com)';
      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Check out this link and another');
      expect(content).not.toContain('](');
      expect(content).not.toContain('https://');
    });

    it('should remove code blocks', async () => {
      const filePath = path.join(tempDir, 'code.md');
      const markdown = 'Before code\n```javascript\nconst x = 1;\n```\nAfter code\n\n`inline code` here';
      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Before code\n\nAfter code\n\ninline code here');
      expect(content).not.toContain('```');
      expect(content).not.toContain('const x');
    });

    it('should preserve paragraph structure', async () => {
      const filePath = path.join(tempDir, 'paragraphs.md');
      const markdown = 'Paragraph 1\n\nParagraph 2\n\n\n\nParagraph 3';
      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Paragraph 1\n\nParagraph 2\n\nParagraph 3');
      // Should have exactly 2 newlines between paragraphs
      expect(content.split('\n\n').length).toBe(3);
    });

    it('should handle empty markdown files', async () => {
      const filePath = path.join(tempDir, 'empty.md');
      await fs.writeFile(filePath, '', 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('');
    });

    it('should handle complex markdown with multiple elements', async () => {
      const filePath = path.join(tempDir, 'complex.md');
      const markdown = `# Main Title

## Section 1

This is a paragraph with **bold text** and *italic text*.

- Item 1
- Item 2
- Item 3

> This is a blockquote

\`\`\`javascript
function test() {
  return true;
}
\`\`\`

[Link text](https://example.com)

![Image alt text](image.png)`;

      await fs.writeFile(filePath, markdown, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Main Title');
      expect(content).toContain('Section 1');
      expect(content).toContain('bold text');
      expect(content).toContain('italic text');
      expect(content).toContain('Item 1');
      expect(content).toContain('This is a blockquote');
      expect(content).toContain('Link text');
      expect(content).not.toContain('**');
      expect(content).not.toContain('*');
      expect(content).not.toContain('#');
      expect(content).not.toContain('```');
      expect(content).not.toContain('function test()');
      expect(content).not.toContain('](');
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(tempDir, 'nonexistent.md');

      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse markdown file');
    });
  });
});
