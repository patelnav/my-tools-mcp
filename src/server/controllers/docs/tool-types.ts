/**
 * Tool Types and Validation Rules
 * 
 * This module defines the types of tools supported by the documentation system
 * and provides utilities for working with them.
 */

/**
 * Package manager configuration
 */
export interface PackageManagerConfig {
  name: string;
  allowedSubcommands: Set<string>;
  requiresScriptName: Set<string>;  // subcommands that need an additional argument
  installInstructions: string;
}

/**
 * Supported package managers and their configurations
 */
export const PACKAGE_MANAGERS = new Map<string, PackageManagerConfig>([
  ['npm', {
    name: 'npm',
    allowedSubcommands: new Set(['run', 'exec', 'start', 'test']),
    requiresScriptName: new Set(['run', 'exec']),
    installInstructions: 'Install Node.js (includes npm): https://nodejs.org'
  }],
  ['pnpm', {
    name: 'pnpm',
    allowedSubcommands: new Set(['run', 'exec', 'start', 'test']),
    requiresScriptName: new Set(['run', 'exec']),
    installInstructions: 'Install pnpm globally: npm install -g pnpm'
  }],
  ['yarn', {
    name: 'yarn',
    allowedSubcommands: new Set(['run', 'exec', 'start', 'test']),
    requiresScriptName: new Set(['run', 'exec']),
    installInstructions: 'Install Yarn globally: npm install -g yarn'
  }]
]);

/**
 * Documentation retrieval configuration
 */
export const DOC_CONFIG = {
  version: {
    primaryFlag: '--version',
    fallbackFlag: '-v',
    timeout: 2000
  },
  help: {
    primaryFlag: '--help',
    fallbackFlag: '-h',
    timeout: 5000,
    maxOutputSize: 50000
  }
} as const;

/**
 * Security configuration
 */
export const SECURITY_CONFIG = {
  // Characters allowed in tool names (excluding package manager commands)
  validToolNameRegex: /^[a-zA-Z0-9@\-_.]+$/,
  
  // Dangerous patterns that could enable command injection
  dangerousPatterns: [
    '$(', '${', '`',  // Command substitution
    '&&', '||', '|', ';',  // Command chaining
    '/', '\\'  // Path traversal
  ],
  
  // Special characters that are not allowed
  forbiddenChars: new Set('!#$%^&*()=+{}[]\'\"<>?,'.split(''))
} as const;

/**
 * Determines if a command is a package manager command
 */
export function isPackageManagerCommand(command: string): boolean {
  const parts = command.split(' ');
  return PACKAGE_MANAGERS.has(parts[0].toLowerCase());
}

/**
 * Gets the package manager configuration if the command is a package manager command
 */
export function getPackageManagerConfig(command: string): PackageManagerConfig | null {
  const parts = command.split(' ');
  const pmName = parts[0].toLowerCase();
  return PACKAGE_MANAGERS.get(pmName) || null;
}

/**
 * Validates a package manager command structure
 */
export function validatePackageManagerCommand(command: string): boolean {
  const parts = command.split(' ');
  if (parts.length < 2) return false;

  const pmConfig = PACKAGE_MANAGERS.get(parts[0].toLowerCase());
  if (!pmConfig) return false;

  const subcommand = parts[1].toLowerCase();
  if (!pmConfig.allowedSubcommands.has(subcommand)) return false;

  // Check if we need additional arguments
  if (pmConfig.requiresScriptName.has(subcommand) && parts.length < 3) {
    return false;
  }

  // Validate all parts after the package manager name
  return parts.slice(1).every(part => 
    SECURITY_CONFIG.validToolNameRegex.test(part) &&
    !SECURITY_CONFIG.dangerousPatterns.some(pattern => part.includes(pattern)) &&
    ![...SECURITY_CONFIG.forbiddenChars].some(char => part.includes(char))
  );
}

/**
 * Gets installation instructions for a package manager
 */
export function getPackageManagerInstallInstructions(pmName: string): string | null {
  return PACKAGE_MANAGERS.get(pmName.toLowerCase())?.installInstructions || null;
}

/**
 * Checks if a command needs a script/command name
 */
export function requiresScriptName(command: string): boolean {
  const parts = command.split(' ');
  if (parts.length < 2) return false;

  const pmConfig = PACKAGE_MANAGERS.get(parts[0].toLowerCase());
  if (!pmConfig) return false;

  return pmConfig.requiresScriptName.has(parts[1].toLowerCase());
} 