/**
 * Documentation cache module
 * 
 * Provides caching functionality for tool documentation to prevent
 * repeated command execution.
 */

import type { DocumentationResponse } from '@/types/types';
import { logger } from './logger';

class DocumentationCache {
  private cache = new Map<string, DocumentationResponse>();

  /**
   * Gets cached documentation for a tool
   * @param toolName Name of the tool
   * @param projectPath Project path
   * @returns Cached documentation or undefined
   */
  get(toolName: string, projectPath: string): DocumentationResponse | undefined {
    const key = this.getCacheKey(toolName, projectPath);
    const cached = this.cache.get(key);
    if (cached) {
      logger.debug(`Cache hit for ${key}`);
    }
    return cached;
  }

  /**
   * Sets documentation in the cache
   * @param toolName Name of the tool
   * @param projectPath Project path
   * @param documentation Documentation to cache
   */
  set(toolName: string, projectPath: string, documentation: DocumentationResponse): void {
    const key = this.getCacheKey(toolName, projectPath);
    this.cache.set(key, documentation);
    logger.debug(`Cached documentation for ${key}`);
  }

  /**
   * Clears the entire cache
   */
  clear(): void {
    this.cache.clear();
    logger.debug('Documentation cache cleared');
  }

  /**
   * Gets the size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  private getCacheKey(toolName: string, projectPath: string): string {
    return `${toolName}@${projectPath}`;
  }
}

export const docCache = new DocumentationCache(); 