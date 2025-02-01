/**
 * Security module for tool documentation
 * 
 * Handles validation of tool names, arguments, and security measures
 * to prevent command injection and other security risks.
 */

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
 * Validates a tool name for security
 * @param toolName The name of the tool to validate
 * @returns boolean indicating if the tool name is valid
 */
export function validateToolName(toolName: string): boolean {
  // Split for package manager commands (e.g., "pnpm drizzle-kit")
  const parts = toolName.split(' ');
  
  // Check each part of the command
  for (const part of parts) {
    // SECURITY: Reject if part contains disallowed characters
    if (!/^[a-zA-Z0-9@\-_.]+$/.test(part)) {
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
  const validPrefixes = ['npm', 'pnpm', 'yarn', 'cargo', 'go', 'dotnet', 'git'];
  if (parts.length > 1) {
    return validPrefixes.includes(parts[0].toLowerCase());
  }

  return true;
}

/**
 * Validates command arguments against allowed set
 * @param args Array of command arguments to validate
 * @returns boolean indicating if all arguments are allowed
 */
export function validateArgs(args: string[]): boolean {
  return args.every(arg => ALLOWED_ARGS.has(arg));
} 