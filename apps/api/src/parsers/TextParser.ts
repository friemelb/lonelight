import fs from 'fs/promises';
import path from 'path';
import { IParser } from './interfaces/IParser';

/**
 * Parser for plain text files (.txt)
 */
export class TextParser implements IParser {
  /**
   * Check if this parser can handle the given file
   * @param filePath - Absolute path to the file
   * @returns true if file extension is .txt
   */
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.txt';
  }

  /**
   * Parse the text file and extract content
   * @param filePath - Absolute path to the file
   * @returns Extracted text content
   * @throws Error if reading fails
   */
  async parse(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse text file: ${error.message}`);
      }
      throw new Error('Failed to parse text file: Unknown error');
    }
  }
}
