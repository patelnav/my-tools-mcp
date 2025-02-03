/**
 * Command execution module for tool documentation
 * 
 * Handles secure execution of tool commands for version and help text retrieval.
 */

import { spawn } from 'child_process';
import { logger } from './logger';
import { ToolInfo } from './path-scanner';

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
    cwd: tool.workingDirectory,
    timeout: options.timeout || 5000,
    maxOutputSize: options.maxOutputSize || 50000
  };

  switch (tool.type) {
    case 'npm-script':
      command = 'npm';
      finalArgs = ['run', tool.name.replace('npm:', ''), ...args];
      break;
    
    case 'package-bin':
    case 'workspace-bin':
      command = tool.name;
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
      logger.debug(`Executing command: ${command} ${args.join(' ')} in ${options.cwd}`);
      
      const child = spawn(command, args, {
        cwd: options.cwd,
        shell: false, // Security: Disable shell execution
        timeout // Security: Timeout after specified duration
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        // Security: Limit output size
        if (output.length > maxOutputSize) {
          child.kill();
          reject(new Error('Output exceeds size limit'));
          return;
        }
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code: number | null) => {
        // Some tools output help to stderr, so we'll use either
        const finalOutput = output || error;
        resolve({
          output: finalOutput.slice(0, maxOutputSize),
          code: code ?? 1 // Use 1 as default error code if null
        });
      });

      child.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
          reject(new Error(`Command not found: ${command}. Please ensure it is installed and available in your PATH.`));
        } else if (err.code === 'EACCES') {
          reject(new Error(`Permission denied executing command: ${command}. Please check file permissions.`));
        } else if (err.code === 'ETIMEDOUT') {
          reject(new Error(`Command timed out after ${timeout}ms: ${command}`));
        } else {
          reject(err);
        }
      });
    } catch (error) {
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
  try {
    // For npm scripts, check if the script exists in package.json
    if (tool.type === 'npm-script') {
      return true; // We assume it exists since we got it from package.json
    }

    // For other tools, try running with --version
    const result = await executeTool(tool, ['--version'], {
      timeout: 2000,
      maxOutputSize: 1000
    });
    
    return result.code === 0;
  } catch (error) {
    logger.debug(`Tool not executable: ${tool.name}`, error);
    return false;
  }
} 