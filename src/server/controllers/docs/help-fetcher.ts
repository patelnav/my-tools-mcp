/**
 * Help text fetcher module
 * 
 * Handles fetching and processing of tool help text documentation.
 */

import { executeCommand } from './command-executor';
import { validateToolName } from './security';
import { validateProjectPath } from './path-validator';
import { validateArgs } from './security';
import { logger } from './logger';

const HELP_TIMEOUT = 5000;
const HELP_MAX_SIZE = 50000;

/**
 * Fetches help text for a tool
 * @param toolName Name of the tool
 * @param projectPath Project path
 * @returns Promise<string> Help text
 */
export async function getToolHelpText(toolName: string, projectPath: string): Promise<string> {
  try {
    // Validate inputs
    if (!validateToolName(toolName)) {
      throw new Error('Tool name not permitted');
    }
    if (!await validateProjectPath(projectPath)) {
      throw new Error('Project path is invalid');
    }

    // Try --help first, then fall back to -h
    return await tryGetHelpText(toolName, projectPath, ['--help'])
      .catch(() => tryGetHelpText(toolName, projectPath, ['-h']));
  } catch (error) {
    logger.error(`Failed to get help text for ${toolName}: ${error}`);
    throw error;
  }
}

/**
 * Attempts to get help text using specified arguments
 * @param toolName Name of the tool
 * @param projectPath Project path
 * @param args Help arguments to try
 * @returns Promise<string>
 */
async function tryGetHelpText(toolName: string, projectPath: string, args: string[]): Promise<string> {
  if (!validateArgs(args)) {
    throw new Error('Invalid help command arguments');
  }

  logger.debug(`Trying to get help text for ${toolName} with args: ${args.join(' ')}`);
  
  const result = await executeCommand(toolName, args, {
    cwd: projectPath,
    timeout: HELP_TIMEOUT,
    maxOutputSize: HELP_MAX_SIZE
  });

  if (result.code !== 0) {
    throw new Error(`Help command failed with code ${result.code}`);
  }

  return result.output;
} 