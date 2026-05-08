import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { TextParser } from './TextParser';

describe('TextParser', () => {
  let parser: TextParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new TextParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('canParse', () => {
    it('should return true for .txt files', () => {
      expect(parser.canParse('/path/to/file.txt')).toBe(true);
    });

    it('should return false for non-.txt files', () => {
      expect(parser.canParse('/path/to/file.pdf')).toBe(false);
      expect(parser.canParse('/path/to/file.csv')).toBe(false);
      expect(parser.canParse('/path/to/file.json')).toBe(false);
      expect(parser.canParse('/path/to/file.md')).toBe(false);
    });

    it('should handle uppercase extensions', () => {
      expect(parser.canParse('/path/to/file.TXT')).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse simple text file', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      await fs.writeFile(filePath, 'Hello, World!', 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Hello, World!');
    });

    it('should handle UTF-8 encoding', async () => {
      const filePath = path.join(tempDir, 'utf8.txt');
      const utf8Content = 'Hello 世界 🌍 Привет';
      await fs.writeFile(filePath, utf8Content, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe(utf8Content);
    });

    it('should handle empty files', async () => {
      const filePath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(filePath, '', 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('');
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(tempDir, 'nonexistent.txt');

      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse text file');
    });

    it('should handle large files', async () => {
      const filePath = path.join(tempDir, 'large.txt');
      // Create 10KB of text content
      const largeContent = 'A'.repeat(10 * 1024);
      await fs.writeFile(filePath, largeContent, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe(largeContent);
      expect(content.length).toBe(10 * 1024);
    });

    it('should preserve line breaks and formatting', async () => {
      const filePath = path.join(tempDir, 'multiline.txt');
      const multilineContent = 'Line 1\nLine 2\n\nLine 4 with tab\there';
      await fs.writeFile(filePath, multilineContent, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe(multilineContent);
    });

    it('should handle files with special characters', async () => {
      const filePath = path.join(tempDir, 'special.txt');
      const specialContent = 'Special chars: !@#$%^&*()[]{}|\\:;"\'<>,.?/~`';
      await fs.writeFile(filePath, specialContent, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe(specialContent);
    });
  });
});
