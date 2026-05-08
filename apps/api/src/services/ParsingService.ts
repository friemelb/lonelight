import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentRecord, DocumentChunk } from '@loanlens/domain';
import { IParser, TextParser, MarkdownParser, CsvParser, JsonParser, PdfParser, DocxParser } from '@/parsers';
import { ChunkingService } from './ChunkingService';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Result of parsing and chunking operation
 */
export interface ParseResult {
  chunks: DocumentChunk[];
  success: boolean;
  error?: string;
}

/**
 * Service for parsing documents and chunking their content
 */
export class ParsingService {
  private parsers: IParser[];
  private chunkingService: ChunkingService;

  constructor() {
    // Initialize all available parsers
    this.parsers = [
      new TextParser(),
      new MarkdownParser(),
      new CsvParser(),
      new JsonParser(),
      new PdfParser(),
      new DocxParser()
    ];

    this.chunkingService = new ChunkingService();
  }

  /**
   * Parse a document and chunk its content
   * @param documentRecord - The document record to parse
   * @returns Parse result with chunks or error
   */
  async parseAndChunkDocument(documentRecord: DocumentRecord): Promise<ParseResult> {
    try {
      // Construct the full file path
      const dataDir = path.join(__dirname, '../../data');
      const fullPath = path.join(dataDir, documentRecord.storagePath);

      // Find a parser that can handle this file
      const parser = this.parsers.find(p => p.canParse(fullPath));

      if (!parser) {
        return {
          chunks: [],
          success: false,
          error: `No parser available for file type: ${path.extname(documentRecord.filename)}`
        };
      }

      // Parse the file
      let content: string;
      try {
        content = await parser.parse(fullPath);
      } catch (parseError) {
        const errorMessage = parseError instanceof Error
          ? parseError.message
          : 'Unknown parsing error';

        return {
          chunks: [],
          success: false,
          error: `Failed to parse document: ${errorMessage}`
        };
      }

      // Chunk the parsed content
      const chunks = this.chunkingService.chunkContent(
        content,
        documentRecord.id
      );

      return {
        chunks,
        success: true
      };
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : 'Unknown error during parsing and chunking';

      return {
        chunks: [],
        success: false,
        error: errorMessage
      };
    }
  }
}
