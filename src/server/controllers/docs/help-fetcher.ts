/**
 * Help text fetcher for tools
 * 
 * Handles retrieving help text from tools using various methods.
 */

import { logger } from './logger';
import type { ToolInfo } from '@/types/index';
import { executeTool } from './command-executor';

/**
 * Gets the help text for a tool
 * @param tool Tool info
 * @param projectPath Path to execute from
 * @returns Promise<string> Empty string if no help text available
 */
export async function getToolHelpText(tool: ToolInfo, _projectPath: string): Promise<string> {
  try {
    // Don't try to get help text for npm scripts
    if (tool.type === 'script' || tool.type === 'npm-script') {
      return ''; // Return empty string instead of generic message
    }

    // Only try help flags for binaries and tools
    if (tool.type === 'package-bin' || tool.type === 'workspace-bin' || tool.type === 'global-bin') {
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
        : ''; // Return empty string instead of generic message
    }

    return ''; // Return empty string for unknown types
  } catch (error) {
    logger.warn(`Failed to get help text for ${tool.name}:`, error);
    return ''; // Return empty string on error
  }
} 