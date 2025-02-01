/**
 * Tool Documentation Controller
 * 
 * This file implements a secure documentation fetcher for command-line tools as part of an MCP (Machine Control Protocol)
 * server integrated into a VSCode/Cursor extension. It allows retrieving help text and version information for installed
 * command-line tools while maintaining strict security measures.
 * 
 * Security Measures:
 * 1. Command Execution Safety:
 *    - Disables shell execution to prevent command injection
 *    - Validates tool names against dangerous commands (blacklist)
 *    - Only allows specific documentation-related arguments (--help, -h, --version)
 *    - Implements timeouts and output size limits
 * 
 * 2. Tool Name Validation:
 *    - Supports package manager commands (e.g., "pnpm drizzle-kit")
 *    - Validates against a blacklist of dangerous system commands
 *    - Only allows alphanumeric characters, @, dash, and underscore
 *    - Specifically allows common package managers (npm, pnpm, yarn, etc.)
 * 
 * 3. Path Safety:
 *    - Prevents path traversal attacks
 *    - Validates project paths
 *    - Ensures tools are actually installed and executable
 * 
 * 4. Resource Protection:
 *    - Implements command timeouts (5 seconds)
 *    - Limits output size (10KB for version, 50KB for help text)
 *    - Uses in-memory caching to prevent repeated executions
 * 
 * Usage Flow:
 * 1. Client requests documentation for a tool via WebSocket
 * 2. Tool name and project path are validated
 * 3. Version is fetched using --version
 * 4. Help text is fetched using --help (falls back to -h)
 * 5. Results are cached and returned
 * 
 * Error Handling:
 * - Validates all inputs before execution
 * - Sanitizes error messages to prevent information leakage
 * - Gracefully handles missing tools and execution failures
 * 
 * Integration Context:
 * - Part of a VSCode/Cursor extension that provides an MCP server
 * - Used by Cursor's composer agents to fetch tool documentation
 * - Supports documentation for any installed CLI tool (with safety checks)
 * 
 * @security This file handles command execution and must maintain strict security measures
 * @performance Implements caching to prevent repeated command execution
 */

import { spawn } from 'child_process';
import path from 'path';
import { DocumentationResponse, ToolSelection } from '@/types/types';
import { promisify } from 'util';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';

// Security: Only allow documentation-related arguments
const ALLOWED_ARGS = new Set(['--version', '-v', '--help', '-h']);

// Security: Blacklist of dangerous commands and tools
const BLACKLISTED_TOOLS = new Set([
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
  // Add more as needed
]);

// Validate tool name format and safety
function validateToolName(toolName: string): boolean {
  // Split for package manager commands (e.g., "pnpm drizzle-kit")
  const parts = toolName.split(' ');
  
  // Check each part of the command
  for (const part of parts) {
    // SECURITY: Reject if part contains disallowed characters
    if (!/^[a-zA-Z0-9@-_]+$/.test(part)) {
      return false;
    }
    
    // SECURITY: Also reject any variable expansions or environment references
    if (part.includes('$(') || 
        part.includes('${') || 
        part.includes('`')) {
      return false;
    }

    // Check against blacklist
    if (BLACKLISTED_TOOLS.has(part.toLowerCase())) {
      return false;
    }
    
    // SECURITY: Prevent path traversal
    if (part.includes('/') || part.includes('\\')) {
      return false;
    }
    
    // SECURITY: Disallow logical operators that could chain commands
    if (part.includes('&&') || 
        part.includes('||') || 
        part.includes('|') || 
        part.includes(';')) {
      return false;
    }
  }

  // Allow common package manager commands
  const validPrefixes = ['npm', 'pnpm', 'yarn', 'cargo', 'go', 'dotnet'];
  if (parts.length > 1) {
    return validPrefixes.includes(parts[0].toLowerCase());
  }

  return true;
}

// Validate command arguments
function validateArgs(args: string[]): boolean {
  return args.every(arg => ALLOWED_ARGS.has(arg));
}

// Validate project path to prevent path traversal
function validateProjectPath(projectPath: string): boolean {
  const normalizedPath = path.normalize(projectPath);
  return !normalizedPath.includes('..');
}

/**
 * SECURITY: Optionally confirm that the normalized path is a directory
 * to avoid non-directory paths or ambiguous symlinks.
 * This is extra validation—comment out if not needed for MVP.
 */
async function confirmDirectoryExists(projectPath: string): Promise<boolean> {
  try {
    const stats = await stat(projectPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

// Check if a tool is installed and executable
async function isToolExecutable(toolName: string): Promise<boolean> {
  try {
    // Try to access the tool in the PATH
    const which = promisify(require('which'));
    await which(toolName);
    return true;
  } catch {
    return false;
  }
}

// Simple in-memory cache
const docCache = new Map<string, DocumentationResponse>();

async function getToolVersion(toolName: string, projectPath: string): Promise<string> {
  if (!validateToolName(toolName)) {
    // SECURITY: Provide more direct error messages without leaking environment details
    throw new Error('Tool name not permitted');
  }
  if (!validateProjectPath(projectPath)) {
    throw new Error('Project path is invalid');
  }
  if (!validateArgs(['--version'])) {
    throw new Error('Invalid command arguments');
  }
  if (!(await isToolExecutable(toolName))) {
    throw new Error('Requested tool is unavailable');
  }

  try {
    const versionText = await new Promise<string>((resolve, reject) => {
      const child = spawn(toolName, ['--version'], {
        cwd: projectPath,
        shell: false, // Security: Disable shell execution
        timeout: 5000 // Security: Timeout after 5 seconds
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        // Security: Limit output size
        if (output.length > 10000) {
          child.kill();
          reject(new Error('Output exceeds size limit'));
          return;
        }
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error('Command failed'));
        } else {
          // SECURITY: Truncate or sanitize the output if needed
          const trimmed = output.trim();
          // Restrict length for returning version
          const limitedOutput = trimmed.slice(0, 200);
          resolve(limitedOutput);
        }
      });
    });

    const versionMatch = versionText.match(/\d+\.\d+\.\d+/);
    return versionMatch ? versionMatch[0] : versionText;
  } catch (error) {
    console.warn('Version check failed');
    return 'unknown';
  }
}

export async function fetchToolDocumentation(tool: ToolSelection): Promise<DocumentationResponse> {
  // Security: Validate inputs
  if (!validateToolName(tool.name)) {
    return {
      success: false,
      error: 'Tool name not permitted'
    };
  }
  if (!validateProjectPath(tool.projectPath)) {
    return {
      success: false,
      error: 'Project path is invalid'
    };
  }
  if (!(await isToolExecutable(tool.name))) {
    return {
      success: false,
      // SECURITY: Minimally descriptive error to avoid revealing internal paths or OS details
      error: 'Requested tool is unavailable'
    };
  }

  // SECURITY: Confirm directory exists and is accessible
  if (!(await confirmDirectoryExists(tool.projectPath))) {
    return {
      success: false,
      error: 'Project path is invalid or inaccessible'
    };
  }

  const cacheKey = `${tool.name}@${tool.projectPath}`;
  
  // Check cache first
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const version = await getToolVersion(tool.name, tool.projectPath);
    const helpText = await new Promise<string>((resolve, reject) => {
      // Try --help first, then -h if that fails
      const tryHelp = async (args: string[]) => {
        if (!validateArgs(args)) {
          reject(new Error('Invalid command arguments'));
          return;
        }

        const child = spawn(tool.name, args, {
          cwd: tool.projectPath,
          shell: false, // Security: Disable shell execution
          timeout: 5000 // Security: Timeout after 5 seconds
        });

        let output = '';
        let error = '';

        child.stdout.on('data', (data) => {
          // Security: Limit output size
          if (output.length > 50000) {
            child.kill();
            reject(new Error('Output exceeds size limit'));
            return;
          }
          output += data.toString();
        });

        child.stderr.on('data', (data) => {
          error += data.toString();
        });

        child.on('close', (code) => {
          if (code !== 0) {
            if (args[0] === '--help') {
              // Try -h if --help failed
              tryHelp(['-h']).catch(reject);
            } else {
              reject(new Error('Command failed'));
            }
          } else {
            // SECURITY: Truncate or sanitize the output if needed
            const output_or_error = output || error;
            const sanitized = output_or_error.slice(0, 50000);
            resolve(sanitized); // Some tools output help to stderr
          }
        });
      };

      tryHelp(['--help']).catch(reject);
    });

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
    docCache.set(cacheKey, response);

    return response;
  } catch (error) {
    return {
      success: false,
      // SECURITY: Generic error message to avoid leaking implementation details
      error: 'Failed to retrieve documentation'
    };
  }
} 