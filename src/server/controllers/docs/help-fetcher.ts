/**
 * Help text fetcher module
 * 
 * Handles fetching and processing of tool help text documentation.
 */

import { executeTool } from './command-executor';
import { logger } from './logger';
import type { ToolInfo } from './path-scanner';

/**
 * Gets the help text for a tool
 * @param tool Tool info
 * @param projectPath Path to execute from
 * @returns Promise<string>
 */
export async function getToolHelpText(tool: ToolInfo, projectPath: string): Promise<string> {
  try {
    const result = await executeTool(tool, ['--help'], {
      timeout: 5000,
      maxOutputSize: 50000
    });

    if (result.code === 0 && result.output.trim()) {
      return result.output.trim();
    }

    // Try -h if --help fails
    const fallbackResult = await executeTool(tool, ['-h'], {
      timeout: 5000,
      maxOutputSize: 50000
    });

    return fallbackResult.code === 0 && fallbackResult.output.trim()
      ? fallbackResult.output.trim()
      : 'Help text not available';
  } catch (error) {
    logger.warn(`Failed to get help text for ${tool.name}:`, error);
    return 'Help text not available';
  }
} 