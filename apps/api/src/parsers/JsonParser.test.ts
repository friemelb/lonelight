import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { JsonParser } from './JsonParser';

describe('JsonParser', () => {
  let parser: JsonParser;
  let tempDir: string;

  beforeEach(async () => {
    parser = new JsonParser();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'parser-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('canParse', () => {
    it('should return true for .json files', () => {
      expect(parser.canParse('/path/to/file.json')).toBe(true);
    });

    it('should return false for non-.json files', () => {
      expect(parser.canParse('/path/to/file.txt')).toBe(false);
      expect(parser.canParse('/path/to/file.csv')).toBe(false);
    });
  });

  describe('parse', () => {
    it('should parse and pretty-print simple JSON', async () => {
      const filePath = path.join(tempDir, 'simple.json');
      const json = '{"name":"John","age":30}';
      await fs.writeFile(filePath, json, 'utf-8');

      const content = await parser.parse(filePath);
      const parsed = JSON.parse(content);
      expect(parsed).toEqual({ name: 'John', age: 30 });
      // Should be pretty-printed with indentation
      expect(content).toContain('\n');
      expect(content).toMatch(/\s+"name":/);
    });

    it('should handle nested objects', async () => {
      const filePath = path.join(tempDir, 'nested.json');
      const json = JSON.stringify({
        user: {
          name: 'John',
          address: {
            street: '123 Main St',
            city: 'NYC'
          }
        }
      });
      await fs.writeFile(filePath, json, 'utf-8');

      const content = await parser.parse(filePath);
      const parsed = JSON.parse(content);
      expect(parsed.user.name).toBe('John');
      expect(parsed.user.address.city).toBe('NYC');
      // Should be formatted with proper indentation
      expect(content.split('\n').length).toBeGreaterThan(5);
    });

    it('should handle arrays', async () => {
      const filePath = path.join(tempDir, 'array.json');
      const json = JSON.stringify({
        items: ['apple', 'banana', 'orange'],
        numbers: [1, 2, 3, 4, 5]
      });
      await fs.writeFile(filePath, json, 'utf-8');

      const content = await parser.parse(filePath);
      const parsed = JSON.parse(content);
      expect(parsed.items).toEqual(['apple', 'banana', 'orange']);
      expect(parsed.numbers).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle invalid JSON gracefully', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      const invalidJson = '{"name": "John", "age": }'; // Invalid JSON
      await fs.writeFile(filePath, invalidJson, 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Error: Invalid JSON');
      expect(content).toContain('Original content:');
      expect(content).toContain(invalidJson);
    });

    it('should handle empty JSON files', async () => {
      const filePath = path.join(tempDir, 'empty.json');
      await fs.writeFile(filePath, '', 'utf-8');

      const content = await parser.parse(filePath);
      expect(content).toContain('Error: Invalid JSON');
    });

    it('should handle JSON with special characters', async () => {
      const filePath = path.join(tempDir, 'special.json');
      const json = JSON.stringify({
        message: 'Hello "World"',
        path: 'C:\\Users\\test',
        unicode: '世界 🌍'
      });
      await fs.writeFile(filePath, json, 'utf-8');

      const content = await parser.parse(filePath);
      const parsed = JSON.parse(content);
      expect(parsed.message).toBe('Hello "World"');
      expect(parsed.path).toBe('C:\\Users\\test');
      expect(parsed.unicode).toBe('世界 🌍');
    });

    it('should handle complex JSON structures', async () => {
      const filePath = path.join(tempDir, 'complex.json');
      const json = JSON.stringify({
        borrower: {
          name: 'John Doe',
          ssn: '123-45-6789',
          income: [
            { type: 'W2', amount: 50000 },
            { type: 'Business', amount: 25000 }
          ],
          assets: {
            checking: 10000,
            savings: 50000,
            retirement: 100000
          }
        }
      });
      await fs.writeFile(filePath, json, 'utf-8');

      const content = await parser.parse(filePath);
      const parsed = JSON.parse(content);
      expect(parsed.borrower.name).toBe('John Doe');
      expect(parsed.borrower.income.length).toBe(2);
      expect(parsed.borrower.assets.checking).toBe(10000);
    });

    it('should throw error for non-existent files', async () => {
      const filePath = path.join(tempDir, 'nonexistent.json');

      await expect(parser.parse(filePath)).rejects.toThrow('Failed to parse JSON file');
    });
  });
});
