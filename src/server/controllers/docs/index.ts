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
import { getToolInfo } from './path-scanner';
import {
  isPackageManagerCommand,
  getPackageManagerConfig,
  requiresScriptName,
  getPackageManagerInstallInstructions
} from './tool-types';

function getInvalidToolNameError(toolName: string): string {
  if (isPackageManagerCommand(toolName)) {
    const parts = toolName.split(' ');
    const pmConfig = getPackageManagerConfig(toolName);
    
    if (!pmConfig) {
      return `Unsupported package manager: "${parts[0]}". Use npm, pnpm, or yarn.`;
    }

    if (parts.length === 1) {
      return `Invalid package manager command. Use format: "${pmConfig.name} run <script>" or "${pmConfig.name} exec <command>"`;
    }

    const subcommand = parts[1].toLowerCase();
    if (!pmConfig.allowedSubcommands.has(subcommand)) {
      return `Invalid subcommand "${subcommand}" for ${pmConfig.name}. Valid subcommands: ${[...pmConfig.allowedSubcommands].join(', ')}`;
    }

    if (requiresScriptName(toolName) && parts.length === 2) {
      return `Missing script/command name. Use format: "${pmConfig.name} ${subcommand} <name>"`;
    }

    return `Invalid package manager command: "${toolName}". Valid formats:\n` +
           `- ${pmConfig.name} run <script>\n` +
           `- ${pmConfig.name} exec <command>\n` +
           `- ${pmConfig.name} start\n` +
           `- ${pmConfig.name} test`;
  }

  return `Invalid tool name: "${toolName}". Tool names must only contain alphanumeric characters, hyphens, underscores, dots, or @ symbols.`;
}

/**
 * Fetches documentation for a command-line tool
 * @param tool Tool selection containing name and project path
 * @returns Promise<DocumentationResponse>
 */
export async function fetchToolDocumentation(tool: ToolSelection): Promise<DocumentationResponse> {
  // Security: Validate inputs
  if (!await validateToolName(tool.name, tool.projectPath)) {
    logger.warn(`Invalid tool name: ${tool.name}`);
    return {
      success: false,
      error: getInvalidToolNameError(tool.name)
    };
  }
  
  if (!await validateProjectPath(tool.projectPath)) {
    logger.warn(`Invalid project path: ${tool.projectPath}`);
    return {
      success: false,
      error: 'Project path is invalid or inaccessible'
    };
  }
  
  try {
    // Get tool info from our registry
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
          : `Command "${tool.name}" not found. Please ensure it is installed and available in your PATH.`
      };
    }

    // Check if tool is executable
    const isExecutable = await isToolExecutable(toolInfo);
    if (!isExecutable) {
      logger.warn(`Tool not executable: ${tool.name}`);
      return {
        success: false,
        error: `Command "${tool.name}" exists but is not executable. Please check permissions.`
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