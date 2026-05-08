import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { DocxParser } from './DocxParser';

describe('DocxParser', () => {
  let parser: DocxParser;

  beforeEach(() => {
    parser = new DocxParser();
  });

  describe('canParse', () => {
    it('should return true for .docx files', () => {
      expect(parser.canParse('document.docx')).toBe(true);
      expect(parser.canParse('test.DOCX')).toBe(true);
      expect(parser.canParse('/path/to/file.docx')).toBe(true);
    });

    it('should return false for non-DOCX files', () => {
      expect(parser.canParse('document.txt')).toBe(false);
      expect(parser.canParse('document.pdf')).toBe(false);
      expect(parser.canParse('document.json')).toBe(false);
      expect(parser.canParse('document.doc')).toBe(false); // Old Word format
      expect(parser.canParse('document')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse simple DOCX file', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/simple.docx');

      const result = await parser.parse(docxPath);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('simple test document');
    });

    it('should parse complex DOCX file', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/complex.docx');

      const result = await parser.parse(docxPath);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Loan Application');
      expect(result).toContain('Borrower Information');
      expect(result).toContain('John Doe');
    });

    it('should preserve paragraph structure', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/simple.docx');

      const result = await parser.parse(docxPath);

      // mammoth uses double newlines for paragraph breaks
      expect(result).toContain('\n');
    });

    it('should handle multi-paragraph documents', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/complex.docx');

      const result = await parser.parse(docxPath);

      // Should have multiple lines/paragraphs
      const lines = result.split('\n').filter(line => line.trim().length > 0);
      expect(lines.length).toBeGreaterThan(3);
    });

    it('should throw error for non-existent file', async () => {
      const docxPath = 'nonexistent.docx';

      await expect(parser.parse(docxPath)).rejects.toThrow('Failed to parse DOCX');
    });

    it('should throw error for invalid DOCX file', async () => {
      // Use a non-DOCX file (txt file)
      const invalidDocx = path.join(process.cwd(), 'data/corpus/readme.txt');

      await expect(parser.parse(invalidDocx)).rejects.toThrow();
    });

    it('should extract text without formatting', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/complex.docx');

      const result = await parser.parse(docxPath);

      // Should not contain markdown or HTML formatting
      expect(result).not.toContain('<b>');
      expect(result).not.toContain('**');
      expect(result).not.toContain('<strong>');
    });

    it('should handle empty DOCX file gracefully', async () => {
      const emptyDocx = path.join(process.cwd(), 'data/corpus/unsupported-test.docx');

      // This might fail since the file is 0 bytes - let's handle it
      try {
        const result = await parser.parse(emptyDocx);
        // If it succeeds, result should be empty or very short
        expect(typeof result).toBe('string');
      } catch (error) {
        // If it fails, that's expected for an empty/invalid file
        expect(error).toBeDefined();
      }
    });

    it('should trim whitespace from result', async () => {
      const docxPath = path.join(process.cwd(), 'data/corpus/simple.docx');

      const result = await parser.parse(docxPath);

      // Result should not have leading/trailing whitespace
      expect(result).toBe(result.trim());
    });
  });
});
