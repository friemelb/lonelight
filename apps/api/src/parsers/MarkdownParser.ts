import fs from 'fs/promises';
import path from 'path';
import { IParser } from './interfaces/IParser';

/**
 * Parser for Markdown files (.md)
 * Strips markdown syntax and returns plain text
 */
export class MarkdownParser implements IParser {
  /**
   * Check if this parser can handle the given file
   * @param filePath - Absolute path to the file
   * @returns true if file extension is .md
   */
  canParse(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ext === '.md';
  }

  /**
   * Parse the markdown file and extract plain text content
   * @param filePath - Absolute path to the file
   * @returns Extracted plain text content with markdown syntax removed
   * @throws Error if reading or parsing fails
   */
  async parse(filePath: string): Promise<string> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return this.stripMarkdownSyntax(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse markdown file: ${error.message}`);
      }
      throw new Error('Failed to parse markdown file: Unknown error');
    }
  }

  /**
   * Strip markdown syntax from content
   * @param content - Raw markdown content
   * @returns Plain text content
   */
  private stripMarkdownSyntax(content: string): string {
    let text = content;

    // Remove code blocks (```)
    text = text.replace(/```[\s\S]*?```/g, '');

    // Remove inline code (`code`)
    text = text.replace(/`([^`]+)`/g, '$1');

    // Remove headers (# ## ###)
    text = text.replace(/^#+\s+/gm, '');

    // Remove bold/italic markers (** __ * _)
    text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
    text = text.replace(/__([^_]+)__/g, '$1');
    text = text.replace(/\*([^*]+)\*/g, '$1');
    text = text.replace(/_([^_]+)_/g, '$1');

    // Convert links [text](url) to just text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove images ![alt](url)
    text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

    // Remove horizontal rules
    text = text.replace(/^[-*_]{3,}$/gm, '');

    // Remove blockquotes
    text = text.replace(/^>\s+/gm, '');

    // Remove list markers
    text = text.replace(/^[\s]*[-*+]\s+/gm, '');
    text = text.replace(/^[\s]*\d+\.\s+/gm, '');

    // Preserve paragraph structure (keep double newlines)
    // but remove excessive whitespace
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.trim();

    return text;
  }
}
