import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'path';
import { PdfParser } from './PdfParser';

describe('PdfParser', () => {
  let parser: PdfParser;

  beforeEach(() => {
    parser = new PdfParser();
  });

  describe('canParse', () => {
    it('should return true for .pdf files', () => {
      expect(parser.canParse('document.pdf')).toBe(true);
      expect(parser.canParse('test.PDF')).toBe(true);
      expect(parser.canParse('/path/to/file.pdf')).toBe(true);
    });

    it('should return false for non-PDF files', () => {
      expect(parser.canParse('document.txt')).toBe(false);
      expect(parser.canParse('document.docx')).toBe(false);
      expect(parser.canParse('document.json')).toBe(false);
      expect(parser.canParse('document')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse a real PDF from corpus', async () => {
      // Use a small PDF from the corpus
      const pdfPath = path.join(process.cwd(), 'data/corpus/loan-214/document.pdf');

      const result = await parser.parse(pdfPath);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multi-page PDFs with page markers', async () => {
      // Use a larger multi-page PDF
      const pdfPath = path.join(process.cwd(), 'data/corpus/loan-214/W2 2024- John Homeowner.pdf');

      const result = await parser.parse(pdfPath);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);

      // If multi-page, should have page markers
      if (result.includes('[Page')) {
        expect(result).toContain('[Page 1]');
      }
    });

    it('should handle single-page PDFs without page markers', async () => {
      const pdfPath = path.join(process.cwd(), 'data/corpus/loan-214/EVOE - John Homeowner.pdf');

      const result = await parser.parse(pdfPath);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });

    it('should throw error for non-existent file', async () => {
      const pdfPath = 'nonexistent.pdf';

      await expect(parser.parse(pdfPath)).rejects.toThrow('Failed to parse PDF');
    });

    it('should throw error for invalid PDF file', async () => {
      // Use a non-PDF file (txt file)
      const invalidPdf = path.join(process.cwd(), 'data/corpus/readme.txt');

      await expect(parser.parse(invalidPdf)).rejects.toThrow();
    });

    it('should extract text content correctly', async () => {
      const pdfPath = path.join(process.cwd(), 'data/corpus/loan-214/document.pdf');

      const result = await parser.parse(pdfPath);

      // Should contain some meaningful text (not just whitespace)
      expect(result.trim().length).toBeGreaterThan(10);
    });

    it('should handle PDFs with multiple pages', async () => {
      const pdfPath = path.join(process.cwd(), 'data/corpus/loan-214/Closing_Disclosure.pdf');

      const result = await parser.parse(pdfPath);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
