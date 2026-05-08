import path from 'path';
import fs from 'fs/promises';
import { extractText } from 'unpdf';
import { IParser } from './interfaces/IParser';

export class PdfParser implements IParser {
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.pdf';
  }

  async parse(filePath: string): Promise<string> {
    try {
      // Read PDF file as buffer
      const buffer = await fs.readFile(filePath);

      // Convert Buffer to Uint8Array for unpdf
      const uint8Array = new Uint8Array(buffer);

      // Extract text using unpdf
      // unpdf returns { totalPages: number, text: string[] }
      // where text is an array with one string per page
      const result = await extractText(uint8Array);

      // Format with page markers for multi-page tracking
      if (result.text && result.text.length > 1) {
        return result.text
          .map((pageText: string, index: number) => {
            const pageNum = index + 1;
            return `[Page ${pageNum}]\n${pageText.trim()}`;
          })
          .filter((pageContent: string) => {
            // Filter out pages with only the page marker (empty pages)
            return pageContent.length > `[Page X]`.length + 1;
          })
          .join('\n\n');
      }

      // Single page or empty document
      return result.text && result.text.length > 0 ? result.text[0] : '';
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific PDF errors
        if (error.message.includes('password') || error.message.includes('encrypted')) {
          throw new Error('Failed to parse PDF: Document is password-protected');
        }
        if (error.message.includes('corrupt') || error.message.includes('invalid')) {
          throw new Error('Failed to parse PDF: Document appears to be corrupted or invalid');
        }
        throw new Error(`Failed to parse PDF file: ${error.message}`);
      }
      throw new Error('Failed to parse PDF file: Unknown error');
    }
  }
}
