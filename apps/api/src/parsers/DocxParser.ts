import path from 'path';
import mammoth from 'mammoth';
import { IParser } from './interfaces/IParser';

export class DocxParser implements IParser {
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.docx';
  }

  async parse(filePath: string): Promise<string> {
    try {
      // Extract raw text using mammoth
      const result = await mammoth.extractRawText({ path: filePath });

      // Log any warnings (useful for debugging)
      if (result.messages && result.messages.length > 0) {
        const warnings = result.messages
          .filter(m => m.type === 'warning')
          .map(m => m.message);

        if (warnings.length > 0) {
          console.warn('DOCX parsing warnings:', warnings);
        }
      }

      // Return extracted text
      // mammoth automatically handles paragraphs with double newlines
      return result.value.trim();
    } catch (error) {
      if (error instanceof Error) {
        // Handle specific DOCX errors
        if (error.message.includes('not a valid') || error.message.includes('not a zip')) {
          throw new Error('Failed to parse DOCX: File is not a valid DOCX document');
        }
        if (error.message.includes('encrypted') || error.message.includes('password')) {
          throw new Error('Failed to parse DOCX: Document is password-protected');
        }
        throw new Error(`Failed to parse DOCX file: ${error.message}`);
      }
      throw new Error('Failed to parse DOCX file: Unknown error');
    }
  }
}
