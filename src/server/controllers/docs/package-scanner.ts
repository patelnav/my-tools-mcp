/**
 * Package Scanner Module
 * 
 * Scans package.json files to discover available npm scripts and dependencies.
 * Provides a whitelist-based approach for package manager commands.
 */

import { readFile, readdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { logger } from './logger';
import { constants } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

export type CommandType = 'script' | 'tool' | 'package-manager';
export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export interface Command {
  command: string;
  description: string;
  package?: string;
  type: CommandType;
  group?: string;
}

interface PackageJson {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

export interface PackageScripts {
  scripts: Set<string>;          // npm/pnpm/yarn run <script>
  dependencies: Set<string>;     // npm/pnpm/yarn exec <dependency>
  packageManager?: PackageManager; // Detected package manager
}

// Cache of scanned package.json files
const scriptCache: Record<string, PackageScripts> = {};

// Common help and version flags across many CLI tools
const DOCUMENTATION_FLAGS = {
  help: ['--help', '-h', 'help'],
  version: ['--version', '-v', 'version']
} as const;

// Maximum time to wait for command execution (ms)
const COMMAND_TIMEOUT = 1000;

interface ToolMetadata {
  name: string;
  version?: string;
  hasHelpFlag: boolean;
  category?: string;
}

/**
 * Detects which package manager is being used in a project
 * @param projectPath Path to the project root
 * @returns Promise<PackageManager> The detected package manager
 */
async function detectPackageManager(projectPath: string): Promise<PackageManager> {
  try {
    // Check for lock files
    const hasNpmLock = await access(join(projectPath, 'package-lock.json'), constants.F_OK)
      .then(() => true)
      .catch(() => false);
    
    const hasPnpmLock = await access(join(projectPath, 'pnpm-lock.yaml'), constants.F_OK)
      .then(() => true)
      .catch(() => false);
    
    const hasYarnLock = await access(join(projectPath, 'yarn.lock'), constants.F_OK)
      .then(() => true)
      .catch(() => false);

    // Return based on lock file presence
    if (hasPnpmLock) return 'pnpm';
    if (hasYarnLock) return 'yarn';
    if (hasNpmLock) return 'npm';

    // Default to npm if no lock file found
    return 'npm';
  } catch (error) {
    logger.warn('Error detecting package manager:', error);
    return 'npm'; // Default to npm
  }
}

/**
 * Gets workspace patterns from package.json
 * @param pkg Package.json contents
 * @returns string[] Array of glob patterns
 */
function getWorkspacePatterns(pkg: PackageJson): string[] {
  if (!pkg.workspaces) return [];
  return Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
}

/**
 * Scans a directory recursively for package.json files
 * @param dir Directory to scan
 * @param patterns Glob patterns to match
 * @returns Promise<string[]> Array of package.json paths
 */
async function findPackageJsonFiles(dir: string, patterns: string[] = ['**/package.json']): Promise<string[]> {
  const results: string[] = [];
  
  async function scan(currentDir: string): Promise<void> {
    try {
      const entries = await readdir(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(currentDir, entry.name);
        
        // Skip node_modules
        if (entry.name === 'node_modules') continue;
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.name === 'package.json') {
          results.push(fullPath);
        }
      }
    } catch (error) {
      logger.warn(`Error scanning directory ${currentDir}:`, error);
    }
  }
  
  await scan(dir);
  return results;
}

/**
 * Scans a single package.json file
 * @param packageJsonPath Path to package.json
 * @returns Promise<PackageScripts>
 */
async function scanSinglePackageJson(packageJsonPath: string): Promise<PackageScripts> {
  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg: PackageJson = JSON.parse(content);
    
    return {
      scripts: new Set(Object.keys(pkg.scripts || {})),
      dependencies: new Set([
        ...Object.keys(pkg.dependencies || {}),
        ...Object.keys(pkg.devDependencies || {})
      ])
    };
  } catch (error) {
    logger.error(`Error scanning package.json at ${packageJsonPath}:`, error);
    return { scripts: new Set(), dependencies: new Set() };
  }
}

/**
 * Merges multiple PackageScripts objects
 * @param scripts Array of PackageScripts objects
 * @returns PackageScripts
 */
function mergePackageScripts(scripts: PackageScripts[]): PackageScripts {
  return {
    scripts: new Set(scripts.flatMap(s => [...s.scripts])),
    dependencies: new Set(scripts.flatMap(s => [...s.dependencies])),
    packageManager: scripts[0]?.packageManager // Take the first package manager if available
  };
}

/**
 * Scans all package.json files in a workspace
 * @param projectPath Path to the project root
 * @returns Promise<PackageScripts>
 */
export async function scanPackageJson(projectPath: string): Promise<PackageScripts> {
  // Check cache first
  if (scriptCache[projectPath]) {
    logger.debug('Using cached package info for:', projectPath);
    return scriptCache[projectPath];
  }

  try {
    logger.debug('Scanning package.json in:', projectPath);
    // First scan root package.json
    const rootPackageJsonPath = join(projectPath, 'package.json');
    logger.debug('Looking for root package.json at:', rootPackageJsonPath);
    
    const rootPkgContent = await readFile(rootPackageJsonPath, 'utf-8');
    logger.debug('Root package.json content:', rootPkgContent);
    const rootPkg = JSON.parse(rootPkgContent);
    const workspacePatterns = getWorkspacePatterns(rootPkg);
    
    // Find all package.json files in workspace
    const packageJsonPaths = await findPackageJsonFiles(projectPath, workspacePatterns);
    logger.debug('Found package.json files:', packageJsonPaths);
    
    // Scan each package.json
    const allScripts = await Promise.all(packageJsonPaths.map(scanSinglePackageJson));
    logger.debug('Scanned scripts:', allScripts);
    
    // Merge results
    const result = mergePackageScripts(allScripts);
    logger.debug('Merged results:', result);
    
    // Detect package manager
    result.packageManager = await detectPackageManager(projectPath);
    logger.debug('Detected package manager:', result.packageManager);
    
    // Cache the results
    scriptCache[projectPath] = result;
    return result;
  } catch (error) {
    logger.error('Error scanning workspace:', error);
    return { scripts: new Set(), dependencies: new Set(), packageManager: 'npm' };
  }
}

/**
 * Validates if a package manager command is available
 * @param command Full command string (e.g., "npm run build")
 * @param projectPath Path to the project root
 * @returns Promise<boolean>
 */
export async function isPackageCommandAvailable(command: string, projectPath: string): Promise<boolean> {
  const parts = command.split(' ');
  if (parts.length < 2) return false;

  const [packageManager, subcommand, scriptName] = parts;
  if (!['npm', 'pnpm', 'yarn'].includes(packageManager)) return false;

  const scripts = await scanPackageJson(projectPath);

  switch (subcommand) {
    case 'run':
      if (!scriptName) return false;
      return scripts.scripts.has(scriptName);

    case 'exec':
      if (!scriptName) return false;
      return scripts.dependencies.has(scriptName);

    case 'start':
    case 'test':
      return scripts.scripts.has(subcommand);

    default:
      return false;
  }
}

/**
 * Gets a list of available scripts for a package manager
 * @param projectPath Path to the project root
 * @returns Promise<string[]> List of available script names
 */
export async function getAvailableScripts(projectPath: string): Promise<string[]> {
  const { scripts } = await scanPackageJson(projectPath);
  return [...scripts];
}

/**
 * Gets a list of available dependencies that can be executed
 * @param projectPath Path to the project root
 * @returns Promise<string[]> List of available dependency names
 */
export async function getAvailableDependencies(projectPath: string): Promise<string[]> {
  const { dependencies } = await scanPackageJson(projectPath);
  return [...dependencies];
}

/**
 * Clears the package script cache for a project
 * @param projectPath Path to the project root
 */
export function clearPackageCache(projectPath: string): void {
  delete scriptCache[projectPath];
}

/**
 * Clears all cached package information
 */
export function clearAllPackageCaches(): void {
  Object.keys(scriptCache).forEach(key => delete scriptCache[key]);
}

// Known tool commands that we want to expose
const KNOWN_TOOLS = {
  'drizzle-kit': {
    group: 'database',
    commands: [
      { command: '--help', description: 'Show Drizzle Kit help' },
      { command: 'generate:sqlite --help', description: 'Show help for generate:sqlite command' },
      { command: 'push:sqlite --help', description: 'Show help for push:sqlite command' },
      { command: 'studio --help', description: 'Show help for database studio' },
    ]
  },
  'vitest': {
    group: 'testing',
    commands: [
      { command: '--help', description: 'Show Vitest help' },
      { command: 'run --help', description: 'Show help for test runner' },
      { command: 'watch --help', description: 'Show help for watch mode' },
      { command: '--ui --help', description: 'Show help for UI mode' },
    ]
  }
};

/**
 * Gets package manager specific commands
 */
function getPackageManagerCommands(packageManager: PackageManager): Command[] {
  return [
    { 
      command: `${packageManager} --help`, 
      description: `Show ${packageManager} CLI help`, 
      type: 'package-manager' 
    },
    { 
      command: `${packageManager} run --help`, 
      description: 'Show help for script execution', 
      type: 'package-manager' 
    },
    { 
      command: `${packageManager} exec --help`, 
      description: 'Show help for binary execution', 
      type: 'package-manager' 
    }
  ];
}

/**
 * Tests if a command is available and can show help/version
 */
async function probeToolCapabilities(command: string): Promise<ToolMetadata | null> {
  const metadata: ToolMetadata = {
    name: command,
    hasHelpFlag: false
  };

  try {
    // Run version and help checks in parallel to speed up probing
    const [versionResult, helpResult] = await Promise.allSettled([
      // Version check
      (async () => {
        for (const flag of DOCUMENTATION_FLAGS.version) {
          try {
            const { stdout } = await execFileAsync(command, [flag], { timeout: COMMAND_TIMEOUT });
            if (stdout) {
              const versionMatch = stdout.match(/\d+\.\d+\.\d+/);
              if (versionMatch) {
                return versionMatch[0];
              }
            }
          } catch (error) {
            // Log error and continue with next flag
            logger.debug(`Version check failed for ${command} with flag ${flag}:`, error);
          }
        }
        return null;
      })(),

      // Help check
      (async () => {
        for (const flag of DOCUMENTATION_FLAGS.help) {
          try {
            const { stdout } = await execFileAsync(command, [flag], { timeout: COMMAND_TIMEOUT });
            if (stdout && stdout.length > 0) {
              return true;
            }
          } catch (error) {
            // Log error and continue with next flag
            logger.debug(`Help check failed for ${command} with flag ${flag}:`, error);
          }
        }
        return false;
      })()
    ]);

    // Process results
    if (versionResult.status === 'fulfilled' && versionResult.value) {
      metadata.version = versionResult.value;
    }

    if (helpResult.status === 'fulfilled' && helpResult.value) {
      metadata.hasHelpFlag = true;
    }

    return metadata.hasHelpFlag ? metadata : null;
  } catch (error) {
    logger.error(`Failed to probe capabilities for ${command}:`, error);
    return null;
  }
}

/**
 * Categorize a tool based on its name and available documentation
 */
function categorizeToolCommand(name: string): string {
  // Common categories based on tool names
  if (name.includes('test') || name.includes('jest') || name.includes('mocha')) return 'testing';
  if (name.includes('lint') || name.includes('eslint') || name.includes('prettier')) return 'linting';
  if (name.includes('build') || name.includes('webpack') || name.includes('rollup')) return 'build';
  if (name.includes('db') || name.includes('sql') || name.includes('migrate')) return 'database';
  if (name.includes('dev') || name.includes('serve')) return 'development';
  return 'other';
}

/**
 * Discovers all available tools in node_modules/.bin and PATH
 */
async function discoverTools(projectPath: string): Promise<Command[]> {
  logger.debug(`Starting tool discovery for ${projectPath}`);
  const startTime = Date.now();
  
  const commands: Command[] = [];
  const scanned = await scanPackageJson(projectPath);
  logger.debug(`Package scan completed in ${Date.now() - startTime}ms`);
  
  // Use KNOWN_TOOLS for predefined tools instead of probing
  for (const [toolName, config] of Object.entries(KNOWN_TOOLS)) {
    if (scanned.dependencies.has(toolName)) {
      logger.debug(`Adding known tool: ${toolName}`);
      for (const cmd of config.commands) {
        commands.push({
          command: `${toolName} ${cmd.command}`,
          description: cmd.description,
          type: 'tool',
          group: config.group,
          package: '@test/data' // TODO: Get actual package name
        });
      }
    }
  }
  logger.debug(`Known tools added in ${Date.now() - startTime}ms`);

  // Add package manager commands
  const pmCommands = getPackageManagerCommands(scanned.packageManager || 'npm');
  commands.push(...pmCommands);
  logger.debug(`Package manager commands added in ${Date.now() - startTime}ms`);

  // Add script commands
  for (const script of scanned.scripts) {
    commands.push({
      command: `${scanned.packageManager || 'npm'} run ${script}`,
      description: `Run ${script} script`,
      type: 'script',
      group: categorizeToolCommand(script),
      package: '@test/data' // TODO: Get actual package name
    });
  }
  logger.debug(`Script commands added in ${Date.now() - startTime}ms`);

  logger.debug(`Tool discovery completed in ${Date.now() - startTime}ms, found ${commands.length} commands`);
  return commands;
}

// Update the main getAvailableCommands function to use the new discovery
export async function getAvailableCommands(projectPath: string): Promise<Command[]> {
  return discoverTools(projectPath);
} 