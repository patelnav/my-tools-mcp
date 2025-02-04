/**
 * Command execution module for tool documentation
 * 
 * Handles secure execution of tool commands for version and help text retrieval.
 */

import { spawn } from 'child_process';
import { logger } from '@server/controllers/docs/logger';
import { ToolInfo } from './path-scanner';
import { join } from 'path';

interface CommandOptions {
  cwd: string;
  timeout?: number;
  maxOutputSize?: number;
}

interface CommandResult {
  output: string;
  code: number;
}

interface CommandError extends Error {
  code?: string;
}

/**
 * Executes a tool with proper working directory handling
 * @param tool The tool info
 * @param args Command arguments
 * @param options Additional execution options
 * @returns Promise<CommandResult>
 */
export async function executeTool(
  tool: ToolInfo,
  args: string[],
  options: Partial<CommandOptions> = {}
): Promise<CommandResult> {
  let command: string;
  let finalArgs: string[] = [...args];
  const finalOptions: CommandOptions = {
    cwd: tool.workingDirectory || process.cwd(), // Use process.cwd() as fallback
    timeout: options.timeout || 5000,
    maxOutputSize: options.maxOutputSize || 50000
  };

  logger.debug('Executing tool:', {
    tool,
    args,
    options: finalOptions,
    currentDir: process.cwd()
  });

  switch (tool.type) {
    case 'npm-script':
      command = 'npm';
      finalArgs = ['run', tool.name.replace('npm:', ''), ...args];
      break;
    
    case 'package-bin':
    case 'workspace-bin':
      command = tool.location || tool.name;
      logger.debug('Resolved command path:', {
        command,
        location: tool.location,
        name: tool.name,
        exists: require('fs').existsSync(command)
      });
      break;
    
    default:
      throw new Error(`Unknown tool type: ${(tool as ToolInfo).type}`);
  }

  return executeCommand(command, finalArgs, finalOptions);
}

/**
 * Executes a command with security measures
 * @param command The command to execute
 * @param args Command arguments
 * @param options Execution options
 * @returns Promise<CommandResult>
 */
async function executeCommand(
  command: string,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  const timeout = options.timeout || 5000;
  const maxOutputSize = options.maxOutputSize || 50000;

  return new Promise<CommandResult>((resolve, reject) => {
    try {
      logger.debug('Executing command:', {
        command,
        args,
        cwd: options.cwd,
        timeout,
        maxOutputSize,
        currentDir: process.cwd(),
        commandExists: require('fs').existsSync(command)
      });
      
      const child = spawn(command, args, {
        cwd: options.cwd,
        shell: false, // Security: Disable shell execution
        timeout // Security: Timeout after specified duration
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        logger.debug('Command stdout:', chunk);
        if (output.length + chunk.length <= maxOutputSize) {
          output += chunk;
        }
      });

      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        logger.debug('Command stderr:', chunk);
        error += chunk;
      });

      child.on('error', (err: CommandError) => {
        logger.error('Command error:', {
          error: err,
          code: err.code,
          command,
          args,
          cwd: options.cwd
        });
        if (err.code === 'ENOENT') {
          reject(new Error(`Command not found: ${command}`));
        } else {
          reject(err);
        }
      });

      child.on('close', (code) => {
        logger.debug('Command completed:', { 
          code, 
          output, 
          error,
          command,
          args,
          cwd: options.cwd
        });
        resolve({ output: output || error, code: code || 0 });
      });
    } catch (error) {
      logger.error('Failed to execute command:', {
        error,
        command,
        args,
        cwd: options.cwd
      });
      reject(error);
    }
  });
}

export { executeCommand };

/**
 * Checks if a tool is available and executable
 * @param tool The tool info to check
 * @returns Promise<boolean>
 */
export async function isToolExecutable(tool: ToolInfo): Promise<boolean> {
  if (!tool.name) {
    logger.debug('Tool name is undefined');
    return false;
  }

  try {
    // For scripts, we don't need to check executability
    if (tool.type === 'script' || tool.type === 'npm-script') {
      return true; // Scripts are always "executable" since they're defined in package.json
    }

    // For binaries and tools, check if they're actually executable
    if (tool.type === 'package-bin' || tool.type === 'workspace-bin' || tool.type === 'global-bin') {
      // Try running with --version first (less output than --help)
      const result = await executeTool(tool, ['--version'], {
        timeout: 2000,
        maxOutputSize: 1000
      });
      
      if (result.code === 0) return true;

      // If --version fails, try -v as fallback
      const fallbackResult = await executeTool(tool, ['-v'], {
        timeout: 2000,
        maxOutputSize: 1000
      });

      return fallbackResult.code === 0;
    }

    // For unknown types, assume not executable
    return false;
  } catch (error) {
    logger.debug(`Tool not executable: ${tool.name}`, error);
    return false;
  }
} 