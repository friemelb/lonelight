import fs from 'fs/promises';
import path from 'path';

export interface FileInfo {
  filename: string;
  relativePath: string;
  fullPath: string;
  size: number;
  mimeType: string;
}

/**
 * Service for file system operations and file type handling
 */
export class FileService {
  /**
   * Supported file extensions and their MIME types
   */
  private static readonly MIME_TYPES: Record<string, string> = {
    '.txt': 'text/plain',
    '.csv': 'text/csv',
    '.md': 'text/markdown',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  /**
   * Recursively scan a directory and return information about all files
   * @param directoryPath - Absolute path to the directory to scan
   * @returns Array of FileInfo objects with relative paths from the directory
   */
  async scanDirectory(directoryPath: string): Promise<FileInfo[]> {
    const files: FileInfo[] = [];

    try {
      await this.scanDirectoryRecursive(directoryPath, directoryPath, files);
    } catch (error) {
      console.error(`Error scanning directory ${directoryPath}:`, error);
      throw error;
    }

    return files;
  }

  /**
   * Internal recursive helper for directory scanning
   */
  private async scanDirectoryRecursive(
    basePath: string,
    currentPath: string,
    files: FileInfo[]
  ): Promise<void> {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          // Recursively scan subdirectories
          await this.scanDirectoryRecursive(basePath, fullPath, files);
        } else if (entry.isFile()) {
          // Get file stats
          const stats = await fs.stat(fullPath);
          const relativePath = path.relative(basePath, fullPath);
          const mimeType = this.getMimeType(entry.name);

          files.push({
            filename: entry.name,
            relativePath,
            fullPath,
            size: stats.size,
            mimeType
          });
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error);
      throw error;
    }
  }

  /**
   * Get the MIME type for a file based on its extension
   * @param filename - The filename to check
   * @returns MIME type string or 'application/octet-stream' for unknown types
   */
  getMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    return FileService.MIME_TYPES[ext] || 'application/octet-stream';
  }

  /**
   * Check if a file type is supported for processing
   * @param filename - The filename to check
   * @returns true if the file extension is supported
   */
  isSupportedFileType(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ext in FileService.MIME_TYPES;
  }

  /**
   * Get file statistics including size
   * @param filePath - Absolute path to the file
   * @returns Object containing file size in bytes
   */
  async getFileStats(filePath: string): Promise<{ size: number }> {
    try {
      const stats = await fs.stat(filePath);
      return { size: stats.size };
    } catch (error) {
      console.error(`Error getting stats for ${filePath}:`, error);
      throw error;
    }
  }
}
