import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileService } from './FileService';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('FileService', () => {
  let fileService: FileService;
  let tempDir: string;

  beforeEach(async () => {
    fileService = new FileService();
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileservice-test-'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getMimeType', () => {
    it('should return correct MIME type for .txt files', () => {
      expect(fileService.getMimeType('document.txt')).toBe('text/plain');
      expect(fileService.getMimeType('README.TXT')).toBe('text/plain');
    });

    it('should return correct MIME type for .csv files', () => {
      expect(fileService.getMimeType('data.csv')).toBe('text/csv');
      expect(fileService.getMimeType('spreadsheet.CSV')).toBe('text/csv');
    });

    it('should return correct MIME type for .md files', () => {
      expect(fileService.getMimeType('notes.md')).toBe('text/markdown');
      expect(fileService.getMimeType('README.MD')).toBe('text/markdown');
    });

    it('should return correct MIME type for .json files', () => {
      expect(fileService.getMimeType('config.json')).toBe('application/json');
      expect(fileService.getMimeType('package.JSON')).toBe('application/json');
    });

    it('should return correct MIME type for .pdf files', () => {
      expect(fileService.getMimeType('document.pdf')).toBe('application/pdf');
      expect(fileService.getMimeType('paystub.PDF')).toBe('application/pdf');
    });

    it('should return correct MIME type for .docx files', () => {
      expect(fileService.getMimeType('document.docx')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(fileService.getMimeType('report.DOCX')).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should return application/octet-stream for unsupported file types', () => {
      expect(fileService.getMimeType('image.png')).toBe('application/octet-stream');
      expect(fileService.getMimeType('video.mp4')).toBe('application/octet-stream');
      expect(fileService.getMimeType('file.xyz')).toBe('application/octet-stream');
      expect(fileService.getMimeType('archive.zip')).toBe('application/octet-stream');
    });

    it('should handle filenames without extensions', () => {
      expect(fileService.getMimeType('README')).toBe('application/octet-stream');
      expect(fileService.getMimeType('Dockerfile')).toBe('application/octet-stream');
    });

    it('should handle filenames with multiple dots', () => {
      expect(fileService.getMimeType('my.file.name.pdf')).toBe('application/pdf');
      expect(fileService.getMimeType('data.backup.json')).toBe('application/json');
    });
  });

  describe('isSupportedFileType', () => {
    it('should return true for supported file extensions', () => {
      expect(fileService.isSupportedFileType('document.txt')).toBe(true);
      expect(fileService.isSupportedFileType('data.csv')).toBe(true);
      expect(fileService.isSupportedFileType('notes.md')).toBe(true);
      expect(fileService.isSupportedFileType('config.json')).toBe(true);
      expect(fileService.isSupportedFileType('paystub.pdf')).toBe(true);
      expect(fileService.isSupportedFileType('document.docx')).toBe(true);
    });

    it('should be case-insensitive for file extensions', () => {
      expect(fileService.isSupportedFileType('document.TXT')).toBe(true);
      expect(fileService.isSupportedFileType('data.CSV')).toBe(true);
      expect(fileService.isSupportedFileType('notes.MD')).toBe(true);
      expect(fileService.isSupportedFileType('config.JSON')).toBe(true);
      expect(fileService.isSupportedFileType('paystub.PDF')).toBe(true);
      expect(fileService.isSupportedFileType('report.DOCX')).toBe(true);
    });

    it('should return false for unsupported file extensions', () => {
      expect(fileService.isSupportedFileType('image.png')).toBe(false);
      expect(fileService.isSupportedFileType('video.mp4')).toBe(false);
      expect(fileService.isSupportedFileType('archive.zip')).toBe(false);
      expect(fileService.isSupportedFileType('file.xyz')).toBe(false);
      expect(fileService.isSupportedFileType('spreadsheet.xls')).toBe(false);
    });

    it('should return false for files without extensions', () => {
      expect(fileService.isSupportedFileType('README')).toBe(false);
      expect(fileService.isSupportedFileType('Dockerfile')).toBe(false);
    });
  });

  describe('getFileStats', () => {
    it('should return correct file size for existing files', async () => {
      const testFilePath = path.join(tempDir, 'test.txt');
      const testContent = 'Hello, World!';
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const stats = await fileService.getFileStats(testFilePath);

      expect(stats.size).toBe(Buffer.byteLength(testContent, 'utf-8'));
    });

    it('should return correct size for empty files', async () => {
      const testFilePath = path.join(tempDir, 'empty.txt');
      await fs.writeFile(testFilePath, '', 'utf-8');

      const stats = await fileService.getFileStats(testFilePath);

      expect(stats.size).toBe(0);
    });

    it('should return correct size for larger files', async () => {
      const testFilePath = path.join(tempDir, 'large.txt');
      const testContent = 'A'.repeat(1024 * 10); // 10KB of 'A'
      await fs.writeFile(testFilePath, testContent, 'utf-8');

      const stats = await fileService.getFileStats(testFilePath);

      expect(stats.size).toBe(1024 * 10);
    });

    it('should throw error for non-existent files', async () => {
      const nonExistentPath = path.join(tempDir, 'does-not-exist.txt');

      await expect(fileService.getFileStats(nonExistentPath)).rejects.toThrow();
    });
  });

  describe('scanDirectory', () => {
    it('should scan a directory and return file information', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'Content 1', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'file2.pdf'), 'PDF Content', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'data.csv'), 'CSV Data', 'utf-8');

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(3);
      expect(files.map(f => f.filename).sort()).toEqual(['data.csv', 'file1.txt', 'file2.pdf']);
    });

    it('should return correct file information', async () => {
      const testContent = 'Test content here';
      await fs.writeFile(path.join(tempDir, 'test.txt'), testContent, 'utf-8');

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toMatchObject({
        filename: 'test.txt',
        relativePath: 'test.txt',
        mimeType: 'text/plain',
        size: Buffer.byteLength(testContent, 'utf-8')
      });
      expect(files[0].fullPath).toBe(path.join(tempDir, 'test.txt'));
    });

    it('should recursively scan subdirectories', async () => {
      // Create nested directory structure
      const subDir1 = path.join(tempDir, 'subdir1');
      const subDir2 = path.join(tempDir, 'subdir2');
      const nestedDir = path.join(subDir1, 'nested');

      await fs.mkdir(subDir1);
      await fs.mkdir(subDir2);
      await fs.mkdir(nestedDir);

      // Create files in various locations
      await fs.writeFile(path.join(tempDir, 'root.txt'), 'Root', 'utf-8');
      await fs.writeFile(path.join(subDir1, 'file1.txt'), 'File 1', 'utf-8');
      await fs.writeFile(path.join(subDir2, 'file2.txt'), 'File 2', 'utf-8');
      await fs.writeFile(path.join(nestedDir, 'nested.txt'), 'Nested', 'utf-8');

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(4);
      expect(files.map(f => f.filename).sort()).toEqual([
        'file1.txt',
        'file2.txt',
        'nested.txt',
        'root.txt'
      ]);

      // Check relative paths
      const relativePaths = files.map(f => f.relativePath).sort();
      expect(relativePaths).toContain('root.txt');
      expect(relativePaths).toContain(path.join('subdir1', 'file1.txt'));
      expect(relativePaths).toContain(path.join('subdir2', 'file2.txt'));
      expect(relativePaths).toContain(path.join('subdir1', 'nested', 'nested.txt'));
    });

    it('should return empty array for empty directory', async () => {
      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(0);
    });

    it('should handle directories with only subdirectories (no files)', async () => {
      const subDir = path.join(tempDir, 'empty-subdir');
      await fs.mkdir(subDir);

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(0);
    });

    it('should correctly identify MIME types for all files', async () => {
      await fs.writeFile(path.join(tempDir, 'doc.txt'), 'Text', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'data.csv'), 'CSV', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'notes.md'), 'MD', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'config.json'), '{}', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'doc.pdf'), 'PDF', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'report.docx'), 'DOCX', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'unsupported.xls'), 'XLS', 'utf-8');

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(7);

      const mimeTypes = files.reduce(
        (acc, file) => {
          acc[file.filename] = file.mimeType;
          return acc;
        },
        {} as Record<string, string>
      );

      expect(mimeTypes['doc.txt']).toBe('text/plain');
      expect(mimeTypes['data.csv']).toBe('text/csv');
      expect(mimeTypes['notes.md']).toBe('text/markdown');
      expect(mimeTypes['config.json']).toBe('application/json');
      expect(mimeTypes['doc.pdf']).toBe('application/pdf');
      expect(mimeTypes['report.docx']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(mimeTypes['unsupported.xls']).toBe('application/octet-stream');
    });

    it('should throw error for non-existent directory', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');

      await expect(fileService.scanDirectory(nonExistentDir)).rejects.toThrow();
    });

    it('should handle directories with mixed file types', async () => {
      // Create a variety of files
      await fs.writeFile(path.join(tempDir, 'paystub.pdf'), 'PDF', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'README.md'), 'MD', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'data.json'), '{}', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'notes.txt'), 'Text', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'spreadsheet.csv'), 'CSV', 'utf-8');
      await fs.writeFile(path.join(tempDir, 'image.png'), 'PNG', 'utf-8');

      const files = await fileService.scanDirectory(tempDir);

      expect(files).toHaveLength(6);

      // Verify supported files
      const supportedFiles = files.filter(f => fileService.isSupportedFileType(f.filename));
      expect(supportedFiles).toHaveLength(5);

      // Verify unsupported files
      const unsupportedFiles = files.filter(f => !fileService.isSupportedFileType(f.filename));
      expect(unsupportedFiles).toHaveLength(1);
      expect(unsupportedFiles[0].filename).toBe('image.png');
    });
  });
});
