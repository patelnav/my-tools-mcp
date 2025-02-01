/**
 * Tool Documentation Controller
 * 
 * Main entry point for the documentation system that coordinates
 * validation, command execution, and caching of tool documentation.
 */

import { DocumentationResponse, ToolSelection } from '@/types/types';
import { validateToolName } from './security';
import { validateProjectPath, confirmDirectoryExists } from './path-validator';
import { isToolExecutable } from './command-executor';
import { docCache } from './cache';
import { getToolVersion } from './version-fetcher';
import { getToolHelpText } from './help-fetcher';
import { logger } from './logger';

/**
 * Fetches documentation for a command-line tool
 * @param tool Tool selection containing name and project path
 * @returns Promise<DocumentationResponse>
 */
export async function fetchToolDocumentation(tool: ToolSelection): Promise<DocumentationResponse> {
  // Security: Validate inputs
  if (!validateToolName(tool.name)) {
    logger.warn(`Invalid tool name: ${tool.name}`);
    return {
      success: false,
      error: 'Tool name not permitted'
    };
  }
  
  if (!await validateProjectPath(tool.projectPath)) {
    logger.warn(`Invalid project path: ${tool.projectPath}`);
    return {
      success: false,
      error: 'Project path is invalid'
    };
  }
  
  try {
    const isExecutable = await isToolExecutable(tool.name);
    if (!isExecutable) {
      logger.warn(`Tool not executable: ${tool.name}`);
      return {
        success: false,
        error: 'Requested tool is unavailable'
      };
    }

    // SECURITY: Confirm directory exists and is accessible
    const dirExists = await confirmDirectoryExists(tool.projectPath);
    if (!dirExists) {
      logger.warn(`Directory not accessible: ${tool.projectPath}`);
      return {
        success: false,
        error: 'Project path is invalid or inaccessible'
      };
    }

    // Check cache first
    const cached = docCache.get(tool.name, tool.projectPath);
    if (cached) {
      return cached;
    }

    // Fetch version and help text
    const version = await getToolVersion(tool.name, tool.projectPath);
    const helpText = await getToolHelpText(tool.name, tool.projectPath);

    const response: DocumentationResponse = {
      success: true,
      data: {
        name: tool.name,
        version,
        helpText,
        lastUpdated: new Date().toISOString()
      }
    };

    // Cache the result
    docCache.set(tool.name, tool.projectPath, response);

    return response;
  } catch (error) {
    logger.error(`Error fetching documentation for ${tool.name}:`, error);
    return {
      success: false,
      error: 'Failed to retrieve documentation'
    };
  }
} 