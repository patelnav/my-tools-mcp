/**
 * Tool Documentation Controller
 * 
 * Main entry point for the documentation system that coordinates
 * validation, command execution, and caching of tool documentation.
 */

import type { DocumentationResponse, ToolSelection } from '@/types/index';
import { validateToolName } from './security';
import { validateProjectPath, confirmDirectoryExists } from './path-validator';
import { isToolExecutable } from './command-executor';
import { docCache } from './cache';
import { getToolVersion } from './version-fetcher';
import { getToolHelpText } from './help-fetcher';
import { logger } from './logger';
import { getToolInfo } from './path-scanner';
import {
  isPackageManagerCommand,
  getPackageManagerInstallInstructions
} from './tool-types';
import { ERROR_MESSAGES } from '@/constants';

/**
 * Fetches documentation for a command-line tool
 * @param tool Tool selection containing name and project path
 * @returns Promise<DocumentationResponse>
 */
export async function fetchToolDocumentation(tool: ToolSelection): Promise<DocumentationResponse> {
  // Security: Validate project path first
  if (!await validateProjectPath(tool.projectPath)) {
    logger.warn(`Invalid project path: ${tool.projectPath}`);
    return {
      success: false,
      error: ERROR_MESSAGES.INVALID_PROJECT_PATH
    };
  }
  
  try {
    // Get tool info from our registry first
    const toolInfo = await getToolInfo(tool.projectPath, tool.name);
    if (!toolInfo) {
      const baseCommand = tool.name.split(' ')[0];
      const isPackageManager = isPackageManagerCommand(tool.name);
      
      logger.warn(`Tool not found: ${tool.name}`);
      return {
        success: false,
        error: isPackageManager
          ? `Package manager "${baseCommand}" not found. ${getPackageManagerInstallInstructions(baseCommand)}\n` +
            'Make sure the package manager is available in your PATH after installation.'
          : ERROR_MESSAGES.TOOL_NOT_FOUND(tool.name)
      };
    }

    // Security: Now validate the tool name format
    if (!await validateToolName(tool.name, tool.projectPath)) {
      logger.warn(`Invalid tool name: ${tool.name}`);
      return {
        success: false,
        error: ERROR_MESSAGES.INVALID_TOOL_NAME(tool.name)
      };
    }

    // Check if tool is executable
    const isExecutable = await isToolExecutable(toolInfo);
    if (!isExecutable) {
      logger.warn(`Tool not executable: ${tool.name}`);
      return {
        success: false,
        error: ERROR_MESSAGES.TOOL_NOT_EXECUTABLE(tool.name)
      };
    }

    // SECURITY: Confirm directory exists and is accessible
    const dirExists = await confirmDirectoryExists(tool.projectPath);
    if (!dirExists) {
      logger.warn(`Directory not accessible: ${tool.projectPath}`);
      return {
        success: false,
        error: ERROR_MESSAGES.INVALID_PROJECT_PATH
      };
    }

    // Check cache first
    const cached = docCache.get(tool.name, tool.projectPath);
    if (cached) {
      return cached;
    }

    // Fetch version and help text using the full tool info
    const version = await getToolVersion(toolInfo, tool.projectPath);
    const helpText = await getToolHelpText(toolInfo, tool.projectPath);

    const response: DocumentationResponse = {
      success: true,
      data: {
        name: tool.name,
        version,
        helpText,
        lastUpdated: Date.now()
      }
    };

    // Cache the result
    docCache.set(tool.name, tool.projectPath, response);

    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error fetching documentation for ${tool.name}:`, error);
    return {
      success: false,
      error: `Failed to retrieve documentation: ${errorMessage}. Please ensure the command is valid and try again.`
    };
  }
} 