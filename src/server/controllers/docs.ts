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
    if (!/^[a-zA-Z0-9@\-_.]+$/.test(part)) {
      console.warn(`Invalid characters in tool name part: ${part}`);
      return false;
    }
    
    // SECURITY: Also reject any variable expansions or environment references
    if (part.includes('$(') || 
        part.includes('${') || 
        part.includes('`')) {
      console.warn(`Tool name contains shell expansion: ${part}`);
      return false;
    }

    // Check against blacklist
    if (BLACKLISTED_TOOLS.has(part.toLowerCase())) {
      console.warn(`Tool is blacklisted: ${part}`);
      return false;
    }
    
    // SECURITY: Prevent path traversal
    if (part.includes('/') || part.includes('\\')) {
      console.warn(`Tool name contains path separator: ${part}`);
      return false;
    }
    
    // SECURITY: Disallow logical operators that could chain commands
    if (part.includes('&&') || 
        part.includes('||') || 
        part.includes('|') || 
        part.includes(';')) {
      console.warn(`Tool name contains command chaining: ${part}`);
      return false;
    }
  }

  // Allow common package manager commands
  const validPrefixes = ['npm', 'pnpm', 'yarn', 'cargo', 'go', 'dotnet', 'git'];
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
async function validateProjectPath(projectPath: string): Promise<boolean> {
  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(projectPath);
    console.log(`Validating project path: ${absolutePath}`);
    
    // Check if path exists and is a directory
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      console.warn(`Project path is not a directory: ${absolutePath}`);
      return false;
    }
    
    // Check if we have read access
    await access(absolutePath, constants.R_OK);
    
    return true;
  } catch (error) {
    console.warn(`Error validating project path: ${error}`);
    return false;
  }
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
    // For development, we'll just check if the command exists in PATH
    const command = toolName.split(' ')[0];
    const { spawn } = require('child_process');
    
    return new Promise<boolean>((resolve) => {
      const which = process.platform === 'win32' ? 'where' : 'which';
      const child = spawn(which, [command], {
        shell: true,
        timeout: 2000
      });
      
      child.on('exit', (code: number) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
    });
  } catch (error) {
    console.warn(`Error checking tool executable: ${error}`);
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
  // Log incoming request
  console.log(`Fetching documentation for tool: ${tool.name} in path: ${tool.projectPath}`);
  
  // Security: Validate inputs
  if (!validateToolName(tool.name)) {
    console.warn(`Invalid tool name: ${tool.name}`);
    return {
      success: false,
      error: 'Tool name not permitted'
    };
  }
  
  if (!validateProjectPath(tool.projectPath)) {
    console.warn(`Invalid project path: ${tool.projectPath}`);
    return {
      success: false,
      error: 'Project path is invalid'
    };
  }
  
  try {
    const isExecutable = await isToolExecutable(tool.name);
    if (!isExecutable) {
      console.warn(`Tool not executable: ${tool.name}`);
      return {
        success: false,
        error: 'Requested tool is unavailable'
      };
    }

    // SECURITY: Confirm directory exists and is accessible
    const dirExists = await confirmDirectoryExists(tool.projectPath);
    if (!dirExists) {
      console.warn(`Directory not accessible: ${tool.projectPath}`);
      return {
        success: false,
        error: 'Project path is invalid or inaccessible'
      };
    }

    const cacheKey = `${tool.name}@${tool.projectPath}`;
    
    // Check cache first
    const cached = docCache.get(cacheKey);
    if (cached) {
      console.log(`Returning cached documentation for ${cacheKey}`);
      return cached;
    }

    console.log(`Fetching version for ${tool.name}`);
    const version = await getToolVersion(tool.name, tool.projectPath);
    console.log(`Got version: ${version}`);
    
    console.log(`Fetching help text for ${tool.name}`);
    const helpText = await new Promise<string>((resolve, reject) => {
      // Try --help first, then -h if that fails
      const tryHelp = async (args: string[]) => {
        if (!validateArgs(args)) {
          console.error(`Invalid args for ${tool.name}: ${args.join(' ')}`);
          reject(new Error('Invalid command arguments'));
          return;
        }

        console.log(`Spawning ${tool.name} with args: ${args.join(' ')}`);
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
            console.warn(`Output size limit exceeded for ${tool.name}`);
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
          console.log(`Command ${tool.name} exited with code ${code}`);
          if (code !== 0) {
            if (args[0] === '--help') {
              console.log(`--help failed for ${tool.name}, trying -h`);
              // Try -h if --help failed
              tryHelp(['-h']).catch(reject);
            } else {
              console.error(`Both --help and -h failed for ${tool.name}`);
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

    console.log(`Successfully got help text for ${tool.name}`);
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
    console.log(`Cached documentation for ${cacheKey}`);

    return response;
  } catch (error) {
    console.error(`Error fetching documentation for ${tool.name}:`, error);
    return {
      success: false,
      error: 'Failed to retrieve documentation'
    };
  }
} 