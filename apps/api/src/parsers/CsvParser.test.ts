import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { CsvParser } from './CsvParser';

describe('CsvParser', () => {
  let parser: CsvParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new CsvParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('canParse', () => {
    it('should return true for .csv files', () => {
      expect(parser.canParse('/path/to/file.csv')).toBe(true);
    });

    it('should return false for non-.csv files', () => {
      expect(parser.canParse('/path/to/file.txt')).toBe(false);
      expect(parser.canParse('/path/to/file.json')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse basic CSV with headers', async () => {
      const filePath = path.join(tempDir, 'basic.csv');
      const csv = 'Name,Age,City\nJohn,30,NYC\nJane,25,LA';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Name: John');
      expect(content).toContain('Age: 30');
      expect(content).toContain('City: NYC');
      expect(content).toContain('Name: Jane');
      expect(content).toContain('Age: 25');
      expect(content).toContain('City: LA');
    });

    it('should handle quoted fields with commas', async () => {
      const filePath = path.join(tempDir, 'quoted.csv');
      const csv = 'Name,Address,Phone\n"Smith, John","123 Main St, Apt 4","555-1234"';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Name: Smith, John');
      expect(content).toContain('Address: 123 Main St, Apt 4');
      expect(content).toContain('Phone: 555-1234');
    });

    it('should handle escaped quotes', async () => {
      const filePath = path.join(tempDir, 'escaped.csv');
      const csv = 'Name,Quote\nJohn,"He said ""Hello"""';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Name: John');
      expect(content).toContain('Quote: He said "Hello"');
    });

    it('should format rows as "Column: value" format', async () => {
      const filePath = path.join(tempDir, 'format.csv');
      const csv = 'Product,Price,Stock\nApple,1.50,100';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      const lines = content.split('\n');
      expect(lines[0]).toBe('Product: Apple, Price: 1.50, Stock: 100');
    });

    it('should handle empty CSV files', async () => {
      const filePath = path.join(tempDir, 'empty.csv');
      await fs.writeFile(filePath, '', 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('');
    });

    it('should handle CSV without headers', async () => {
      const filePath = path.join(tempDir, 'no-headers.csv');
      const csv = 'Value1,Value2,Value3';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Value1, Value2, Value3');
    });

    it('should handle CSV with only headers', async () => {
      const filePath = path.join(tempDir, 'headers-only.csv');
      const csv = 'Name,Age,City';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toBe('Name, Age, City');
    });

    it('should handle multiple rows correctly', async () => {
      const filePath = path.join(tempDir, 'multiple.csv');
      const csv = 'ID,Name,Score\n1,Alice,95\n2,Bob,87\n3,Charlie,92';
      await fs.writeFile(filePath, csv, 'utf-8');

      const content = await parser.parse(filePath);
      const lines = content.split('\n');
      expect(lines.length).toBe(3);
      expect(lines[0]).toContain('ID: 1');
      expect(lines[1]).toContain('ID: 2');
      expect(lines[2]).toContain('ID: 3');
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(tempDir, 'nonexistent.csv');

      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse CSV file');
    });
  });
});
