import fs from 'fs/promises';
import path from 'path';
import { IParser } from './interfaces/IParser';

/**
 * Parser for JSON files (.json)
 * Formats JSON data as readable text
 */
export class JsonParser implements IParser {
  /**
   * Check if this parser can handle the given file
   * @param filePath - Absolute path to the file
   * @returns true if file extension is .json
   */
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.json';
  }

  /**
   * Parse the JSON file and format as readable text
   * @param filePath - Absolute path to the file
   * @returns Pretty-printed JSON content
   * @throws Error if reading or parsing fails
   */
  async parse(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');

      // Try to parse the JSON
      try {
        const jsonObj = JSON.parse(content);
        // Pretty-print with 2-space indentation
        return JSON.stringify(jsonObj, null, 2);
      } catch (parseError) {
        // If JSON parsing fails, return error message with original content
        if (parseError instanceof Error) {
          return `Error: Invalid JSON - ${parseError.message}\n\nOriginal content:\n${content}`;
        }
        return `Error: Invalid JSON format\n\nOriginal content:\n${content}`;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse JSON file: ${error.message}`);
      }
      throw new Error('Failed to parse JSON file: Unknown error');
    }
  }
}
