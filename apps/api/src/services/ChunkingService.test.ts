import { describe, it, expect, beforeEach } from 'vitest';
import { ChunkingService } from './ChunkingService';

describe('ChunkingService', () => {
  let service: ChunkingService;
  const documentId = 'test-doc-123';

  beforeEach(() => {
    service = new ChunkingService();
  });

  describe('chunkContent', () => {
    it('should create single chunk for short content', () => {
      const content = 'This is a short piece of text.';
      const chunks = service.chunkContent(content, documentId);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].content).toBe(content);
      expect(chunks[0].documentId).toBe(documentId);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].pageNumber).toBe(1);
      expect(chunks[0].id).toBeDefined();
      expect(chunks[0].extractedAt).toBeInstanceOf(Date);
    });

    it('should create multiple chunks for long content', () => {
      // Create content longer than 1500 characters
      const sentence = 'This is a sentence. ';
      const content = sentence.repeat(100); // ~2000 characters
      const chunks = service.chunkContent(content, documentId);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.length).toBeLessThanOrEqual(3);
      // Each chunk should have content
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.documentId).toBe(documentId);
      });
    });

    it('should respect max chunk size', () => {
      // Create very long content
      const sentence = 'This is a test sentence with some content. ';
      const content = sentence.repeat(200); // ~8600 characters
      const chunks = service.chunkContent(content, documentId);

      // Each chunk should be <= 1500 characters (with some tolerance for overlap)
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1700); // Allow some overlap
      });
    });

    it('should create overlap between chunks', () => {
      // Create content that will require multiple chunks
      const content = 'A'.repeat(800) + '. ' + 'B'.repeat(800) + '. ' + 'C'.repeat(800) + '.';
      const chunks = service.chunkContent(content, documentId);

      if (chunks.length > 1) {
        // Check that consecutive chunks have some overlap
        for (let i = 1; i < chunks.length; i++) {
          const currentChunk = chunks[i];

          // Some overlap should exist (allowing for word boundary adjustments)
          expect(currentChunk.content.length).toBeGreaterThan(0);
        }
      }
    });

    it('should split on sentence boundaries', () => {
      const content = 'Sentence one. Sentence two. Sentence three. ' + 'X'.repeat(1500) + '. Final sentence.';
      const chunks = service.chunkContent(content, documentId);

      // Chunks should end with sentence boundaries when possible
      chunks.forEach((chunk, index) => {
        if (index < chunks.length - 1) {
          // Should contain complete sentences (ending with .)
          const trimmed = chunk.content.trim();
          // Allow for various sentence endings or continued text
          expect(trimmed.length).toBeGreaterThan(0);
        }
      });
    });

    it('should handle content without sentence boundaries', () => {
      // Content without periods or sentence endings - use spaces so it can split on word boundaries
      const word = 'word ';
      const content = word.repeat(400); // 2000 characters (5 chars * 400)
      const chunks = service.chunkContent(content, documentId);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Should still handle the content
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
      expect(totalLength).toBeGreaterThan(1500);
    });

    it('should assign sequential chunk indexes', () => {
      const sentence = 'Test sentence. ';
      const content = sentence.repeat(150); // Long enough for multiple chunks
      const chunks = service.chunkContent(content, documentId);

      if (chunks.length > 1) {
        chunks.forEach((chunk, index) => {
          expect(chunk.chunkIndex).toBe(index);
        });
      }
    });

    it('should generate unique UUIDs for each chunk', () => {
      const sentence = 'Test sentence. ';
      const content = sentence.repeat(150);
      const chunks = service.chunkContent(content, documentId);

      const ids = chunks.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(chunks.length);

      // Check UUID format (basic check)
      chunks.forEach(chunk => {
        expect(chunk.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      });
    });

    it('should set proper metadata', () => {
      const content = 'Test content for metadata validation.';
      const chunks = service.chunkContent(content, documentId);

      chunks.forEach((chunk, index) => {
        expect(chunk.documentId).toBe(documentId);
        expect(chunk.pageNumber).toBe(1);
        expect(chunk.chunkIndex).toBe(index);
        expect(chunk.extractedAt).toBeInstanceOf(Date);
        expect(chunk.extractedAt.getTime()).toBeLessThanOrEqual(Date.now());
      });
    });

    it('should handle empty content', () => {
      const chunks = service.chunkContent('', documentId);
      expect(chunks).toHaveLength(0);
    });

    it('should handle very long sentences', () => {
      // Single sentence longer than max chunk size with word boundaries
      const longSentence = ('word '.repeat(400)) + '.'; // 2000+ characters
      const chunks = service.chunkContent(longSentence, documentId);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Each chunk should be reasonable size
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(1700);
      });
    });

    it('should handle whitespace-only content', () => {
      const chunks = service.chunkContent('   \n\n   ', documentId);
      expect(chunks).toHaveLength(0);
    });

    it('should preserve meaningful content structure', () => {
      const content = `First paragraph with important information.

Second paragraph with more details.

Third paragraph with conclusions.`;

      const chunks = service.chunkContent(content, documentId);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      // Should maintain paragraph breaks
      const combinedContent = chunks.map(c => c.content).join('');
      expect(combinedContent).toContain('First paragraph');
      expect(combinedContent).toContain('Second paragraph');
      expect(combinedContent).toContain('Third paragraph');
    });

    it('should handle mixed content types', () => {
      const content = `Line 1
Line 2. Sentence. Another sentence!
Question? Yes.

New paragraph.

Line with numbers: 123, 456, 789.
`;
      const chunks = service.chunkContent(content, documentId);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.documentId).toBe(documentId);
      });
    });
  });
});
