export interface IParser {
  /**
   * Check if this parser can handle the given file
   * @param filePath - Absolute path to the file
   * @returns true if parser supports this file type
   */
  canParse(filePath: string): boolean;

  /**
   * Parse the file and extract text content
   * @param filePath - Absolute path to the file
   * @returns Extracted text content
   * @throws Error if parsing fails
   */
  parse(filePath: string): Promise<string>;
}
