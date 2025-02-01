/**
 * Command execution module for tool documentation
 * 
 * Handles secure execution of tool commands for version and help text retrieval.
 */

import { spawn } from 'child_process';
import { logger } from './logger';

interface CommandOptions {
  cwd: string;
  timeout?: number;
  maxOutputSize?: number;
}

interface CommandResult {
  output: string;
  code: number;
}

/**
 * Executes a command with security measures
 * @param command The command to execute
 * @param args Command arguments
 * @param options Execution options
 * @returns Promise<CommandResult>
 */
export async function executeCommand(
  command: string,
  args: string[],
  options: CommandOptions
): Promise<CommandResult> {
  const timeout = options.timeout || 5000;
  const maxOutputSize = options.maxOutputSize || 50000;

  return new Promise<CommandResult>((resolve, reject) => {
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

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Checks if a tool is installed and executable
 * @param toolName The name of the tool to check
 * @returns Promise<boolean>
 */
export async function isToolExecutable(toolName: string): Promise<boolean> {
  try {
    // For development, we'll just check if the command exists in PATH
    const command = toolName.split(' ')[0];
    const which = process.platform === 'win32' ? 'where' : 'which';
    
    const result = await executeCommand(which, [command], {
      cwd: process.cwd(),
      timeout: 2000,
      maxOutputSize: 1000
    });
    
    return result.code === 0;
  } catch (error) {
    return false;
  }
} 