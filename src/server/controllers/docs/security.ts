/**
 * Security module for tool documentation
 * 
 * Handles validation of tool names, arguments, and security measures
 * to prevent command injection and other security risks.
 */

import { SECURITY_CONFIG } from './tool-types';
import { isPackageCommandAvailable } from './package-scanner';
import { isBinaryAvailable } from './path-scanner';
import { logger } from './logger';

// Security: Only allow documentation-related arguments
export const ALLOWED_ARGS = new Set(['--version', '-v', '--help', '-h']);

// Security: Blacklist of dangerous commands and tools
export const BLACKLISTED_TOOLS = new Set([
  // System commands that could be dangerous
  'rm', 'rmdir', 'del', 'format',
  'dd', 'mkfs', 'fsutil',
  'chmod', 'chown', 'attrib',
  'sudo', 'su', 'doas',
  'echo', 'printf',
  'wget', 'curl', 'nc', 'netcat',
  'ssh', 'telnet', 'ftp',
  'bash', 'sh', 'zsh', 'fish',
  'cmd', 'powershell', 'pwsh',
  'perl', 'python', 'ruby', 'php', // Raw interpreters (use package managers instead)
  'exec', 'eval', 'source',
  'kill', 'pkill', 'taskkill',
]);

/**
 * Checks if a command contains dangerous patterns
 * @param command Command to check
 * @returns boolean
 */
function hasDangerousPatterns(command: string): boolean {
  return SECURITY_CONFIG.dangerousPatterns.some(pattern => command.includes(pattern)) ||
         [...SECURITY_CONFIG.forbiddenChars].some(char => command.includes(char));
}

/**
 * Validates a tool name for security
 * @param toolName The name of the tool to validate
 * @param projectPath Path to the project root
 * @returns Promise<boolean> indicating if the tool name is valid
 */
export async function validateToolName(toolName: string, projectPath: string): Promise<boolean> {
  // Basic security checks first
  if (!toolName || typeof toolName !== 'string') {
    return false;
  }

  // Check for dangerous patterns
  if (hasDangerousPatterns(toolName)) {
    logger.warn(`Tool name contains dangerous patterns: ${toolName}`);
    return false;
  }

  // Split the command
  const parts = toolName.split(' ');
  const baseCommand = parts[0];
  const lowerBaseCommand = baseCommand.toLowerCase();

  // Check against blacklist
  if (BLACKLISTED_TOOLS.has(lowerBaseCommand)) {
    logger.warn(`Blacklisted tool requested: ${baseCommand}`);
    return false;
  }

  // Handle package manager commands
  if (['npm', 'pnpm', 'yarn'].includes(lowerBaseCommand)) {
    return isPackageCommandAvailable(toolName, projectPath);
  }

  // For direct CLI tools, check if they exist in PATH
  // and validate the name format
  if (!SECURITY_CONFIG.validToolNameRegex.test(baseCommand)) {
    logger.warn(`Invalid tool name format: ${baseCommand}`);
    return false;
  }

  return isBinaryAvailable(baseCommand);
}

/**
 * Validates command arguments against allowed set
 * @param args Array of command arguments to validate
 * @returns boolean indicating if all arguments are allowed
 */
export function validateArgs(args: string[]): boolean {
  return args.every(arg => ALLOWED_ARGS.has(arg));
}

export interface ToolInfo {
  name: string;
  location?: string;
  workingDirectory?: string;
  type?: string;
  context?: Record<string, unknown>;
}

export async function isToolExecutable(tool: string | ToolInfo): Promise<boolean> {
  const toolName = typeof tool === 'string' ? tool : tool.name;
  return validateToolName(toolName, process.cwd());
} 