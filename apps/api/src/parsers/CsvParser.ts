import fs from 'fs/promises';
import path from 'path';
import { IParser } from './interfaces/IParser';

/**
 * Parser for CSV files (.csv)
 * Converts CSV data to formatted text
 */
export class CsvParser implements IParser {
  /**
   * Check if this parser can handle the given file
   * @param filePath - Absolute path to the file
   * @returns true if file extension is .csv
   */
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.csv';
  }

  /**
   * Parse the CSV file and format as readable text
   * @param filePath - Absolute path to the file
   * @returns Formatted text representation of CSV data
   * @throws Error if reading or parsing fails
   */
  async parse(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.formatCsvAsText(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse CSV file: ${error.message}`);
      }
      throw new Error('Failed to parse CSV file: Unknown error');
    }
  }

  /**
   * Format CSV content as readable text
   * @param content - Raw CSV content
   * @returns Formatted text
   */
  private formatCsvAsText(content: string): string {
    const lines = content.trim().split('\n');

    if (lines.length === 0) {
      return '';
    }

    // Parse the header row
    const headers = this.parseCsvLine(lines[0]);

    if (lines.length === 1) {
      return headers.join(', ');
    }

    // Format each data row
    const formattedRows: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCsvLine(lines[i]);

      // Skip empty lines
      if (values.length === 0 || (values.length === 1 && values[0] === '')) {
        continue;
      }

      // Format as "Column1: value1, Column2: value2"
      const pairs: string[] = [];
      for (let j = 0; j < Math.min(headers.length, values.length); j++) {
        pairs.push(`${headers[j]}: ${values[j]}`);
      }

      formattedRows.push(pairs.join(', '));
    }

    return formattedRows.join('\n');
  }

  /**
   * Parse a single CSV line, handling quoted fields and commas
   * @param line - Single line from CSV
   * @returns Array of field values
   */
  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = i < line.length - 1 ? line[i + 1] : null;

      if (char === '"') {
        // Handle escaped quotes ("")
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // Skip the next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator found outside quotes
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add the last field
    fields.push(currentField.trim());

    return fields;
  }
}
