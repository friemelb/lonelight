import { randomUUID } from 'crypto';
import { DocumentChunk } from '@loanlens/domain';

/**
 * Configuration for text chunking
 */
const MAX_CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 100;

/**
 * Service for chunking document content into smaller pieces
 * for efficient processing and retrieval
 */
export class ChunkingService {
  /**
   * Split document content into overlapping chunks
   * @param content - The text content to chunk
   * @param documentId - ID of the parent document
   * @returns Array of document chunks
   */
  chunkContent(content: string, documentId: string): DocumentChunk[] {
    // Handle empty content
    if (!content || content.trim().length === 0) {
      return [];
    }

    // If content is small enough, return as single chunk
    if (content.length <= MAX_CHUNK_SIZE) {
      return [
        {
          id: randomUUID(),
          documentId,
          pageNumber: 1,
          content: content.trim(),
          chunkIndex: 0,
          extractedAt: new Date()
        }
      ];
    }

    // Split content into sentences
    const sentences = this.splitIntoSentences(content);

    // Group sentences into chunks
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];

      // If adding this sentence would exceed max size, save current chunk
      if (currentChunk.length + sentence.length > MAX_CHUNK_SIZE && currentChunk.length > 0) {
        chunks.push({
          id: randomUUID(),
          documentId,
          pageNumber: 1,
          content: currentChunk.trim(),
          chunkIndex,
          extractedAt: new Date()
        });

        // Start new chunk with overlap
        currentChunk = this.getOverlapText(currentChunk, CHUNK_OVERLAP) + sentence;
        chunkIndex++;
      } else {
        currentChunk += sentence;
      }
    }

    // Add the last chunk if it has content
    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: randomUUID(),
        documentId,
        pageNumber: 1,
        content: currentChunk.trim(),
        chunkIndex,
        extractedAt: new Date()
      });
    }

    return chunks;
  }

  /**
   * Split text content into sentences
   * @param content - Text to split
   * @returns Array of sentences
   */
  private splitIntoSentences(content: string): string[] {
    const sentences: string[] = [];

    // Split on sentence endings and paragraph breaks
    // Keep the delimiter with the sentence
    const parts = content.split(/(\.\s+|!\s+|\?\s+|\n\n+)/);

    let currentSentence = '';
    for (const part of parts) {
      currentSentence += part;

      // If this part is a delimiter, we have a complete sentence
      if (/^(\.\s+|!\s+|\?\s+|\n\n+)$/.test(part)) {
        if (currentSentence.trim().length > 0) {
          // If sentence is very long, split on word boundaries
          if (currentSentence.length > MAX_CHUNK_SIZE) {
            sentences.push(...this.splitLongSentence(currentSentence));
          } else {
            sentences.push(currentSentence);
          }
        }
        currentSentence = '';
      }
    }

    // Add any remaining content
    if (currentSentence.trim().length > 0) {
      if (currentSentence.length > MAX_CHUNK_SIZE) {
        sentences.push(...this.splitLongSentence(currentSentence));
      } else {
        sentences.push(currentSentence);
      }
    }

    return sentences;
  }

  /**
   * Split a very long sentence on word boundaries
   * @param sentence - Long sentence to split
   * @returns Array of smaller parts
   */
  private splitLongSentence(sentence: string): string[] {
    const parts: string[] = [];
    const words = sentence.split(/\s+/);
    let currentPart = '';

    for (const word of words) {
      if (currentPart.length + word.length + 1 > MAX_CHUNK_SIZE && currentPart.length > 0) {
        parts.push(currentPart.trim());
        currentPart = word + ' ';
      } else {
        currentPart += word + ' ';
      }
    }

    if (currentPart.trim().length > 0) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  /**
   * Get the last N characters of text for overlap
   * @param text - Text to extract from
   * @param overlapSize - Number of characters to extract
   * @returns Overlap text
   */
  private getOverlapText(text: string, overlapSize: number): string {
    if (text.length <= overlapSize) {
      return text;
    }

    // Try to find a word boundary near the overlap point
    const overlap = text.slice(-overlapSize);
    const spaceIndex = overlap.indexOf(' ');

    if (spaceIndex !== -1) {
      return overlap.slice(spaceIndex + 1) + ' ';
    }

    return overlap + ' ';
  }
}
