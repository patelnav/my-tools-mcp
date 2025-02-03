/**
 * Version fetcher module
 * 
 * Handles fetching and parsing of tool version information.
 */

import { executeTool } from './command-executor';
import { logger } from './logger';
import type { ToolInfo } from './path-scanner';

/**
 * Gets the version of a tool
 * @param tool Tool info
 * @param projectPath Path to execute from
 * @returns Promise<string>
 */
export async function getToolVersion(tool: ToolInfo, projectPath: string): Promise<string> {
  try {
    const result = await executeTool(tool, ['--version'], {
      timeout: 2000,
      maxOutputSize: 1000
    });

    if (result.code === 0 && result.output.trim()) {
      return result.output.trim();
    }

    // Try -v if --version fails
    const fallbackResult = await executeTool(tool, ['-v'], {
      timeout: 2000,
      maxOutputSize: 1000
    });

    return fallbackResult.code === 0 && fallbackResult.output.trim()
      ? fallbackResult.output.trim()
      : 'Version unknown';
  } catch (error) {
    logger.warn(`Failed to get version for ${tool.name}:`, error);
    return 'Version unknown';
  }
} 