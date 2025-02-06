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
export async function getToolHelpText(tool: ToolInfo, _projectPath: string): Promise<string> {
  try {
    // Don't try to get help text for npm scripts
    if (tool.type === 'script' || tool.type === 'npm-script') {
      return 'Help text not available for npm scripts. This is a custom script defined in package.json.';
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
        : 'Help text not available';
    }

    return 'Help text not available for this type of command';
  } catch (error) {
    logger.warn(`Failed to get help text for ${tool.name}:`, error);
    return 'Help text not available';
  }
} 