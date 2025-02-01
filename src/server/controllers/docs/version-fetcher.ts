/**
 * Version fetcher module
 * 
 * Handles fetching and parsing of tool version information.
 */

import { executeCommand } from './command-executor';
import { validateToolName } from './security';
import { validateProjectPath } from './path-validator';
import { logger } from './logger';

const VERSION_TIMEOUT = 5000;
const VERSION_MAX_SIZE = 10000;

/**
 * Fetches the version of a tool
 * @param toolName Name of the tool
 * @param projectPath Project path
 * @returns Promise<string> Version string or 'unknown'
 */
export async function getToolVersion(toolName: string, projectPath: string): Promise<string> {
  try {
    // Validate inputs
    if (!validateToolName(toolName)) {
      throw new Error('Tool name not permitted');
    }
    if (!await validateProjectPath(projectPath)) {
      throw new Error('Project path is invalid');
    }

    // Execute version command
    const result = await executeCommand(toolName, ['--version'], {
      cwd: projectPath,
      timeout: VERSION_TIMEOUT,
      maxOutputSize: VERSION_MAX_SIZE
    });

    if (result.code !== 0) {
      logger.warn(`Version command failed for ${toolName} with code ${result.code}`);
      return 'unknown';
    }

    // Try to extract semantic version
    const versionText = result.output.trim();
    const versionMatch = versionText.match(/\d+\.\d+\.\d+/);
    return versionMatch ? versionMatch[0] : versionText;
  } catch (error) {
    logger.warn(`Error getting version for ${toolName}: ${error}`);
    return 'unknown';
  }
} 