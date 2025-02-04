/**
 * Tool Scanner Module
 * 
 * Scans workspace to discover available command-line tools.
 * Works in conjunction with package-scanner.ts to provide comprehensive tool discovery.
 */

import { readdir, readFile } from 'fs/promises';
import { join, relative, dirname } from 'path';
import { logger } from '@server/controllers/docs/logger';
import { env } from '@/env';

// Cache of scanned tools per workspace
const toolCache = new Map<string, { tools: Map<string, ToolInfo>, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export interface ToolInfo {
  // Required fields
  name: string;
  type: 'script' | 'npm-script' | 'package-bin' | 'workspace-bin' | 'global-bin';
  
  // Optional fields
  location?: string;
  workingDirectory?: string;
  context?: Record<string, unknown>;
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  bin?: Record<string, string> | string;
  workspaces?: string[];
}

/**
 * Checks if a file is executable based on its extension and platform
 * @param filename Name of the file to check
 * @returns boolean
 */
function isExecutable(filename: string): boolean {
  if (process.platform === 'win32') {
    return env.executableExtensions.some(ext => filename.toUpperCase().endsWith(ext));
  }
  return true; // On Unix, we trust the file permissions (handled by readdir)
}

/**
 * Scans PATH for globally available tools
 */
async function scanGlobalBinaries(
  tools: Map<string, ToolInfo>
): Promise<void> {
  // Get PATH directories
  const pathDirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  
  // Common global tools to look for
  const commonTools = ['git', 'node', 'npm', 'yarn', 'pnpm'];
  
  for (const tool of commonTools) {
    // Don't override tools already found in workspace
    if (!tools.has(tool)) {
      tools.set(tool, {
        name: tool,
        type: 'global-bin',
        workingDirectory: process.cwd(),
        context: {}
      });
    }
  }
}

/**
 * Scans the workspace for available command-line tools
 * @param workspacePath The workspace path to scan
 * @returns Promise<Map<string, ToolInfo>> Map of tool names to their info
 */
export async function scanWorkspaceTools(
  workspacePath: string
): Promise<Map<string, ToolInfo>> {
  logger.debug('Scanning workspace for tools:', { workspacePath });
  
  // Check cache first
  const now = Date.now();
  const cached = toolCache.get(workspacePath);
  
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    logger.debug('Using cached tools:', { tools: [...cached.tools.entries()] });
    return cached.tools;
  }

  const tools = new Map<string, ToolInfo>();
  
  try {
    // First scan package.json for scripts and workspaces
    logger.debug('Scanning package.json...');
    await scanPackageJson(workspacePath, tools);
    logger.debug('After package.json scan:', { tools: [...tools.entries()] });

    // Then scan node_modules/.bin at workspace root
    logger.debug('Scanning node_modules/.bin...');
    await scanNodeModulesBin(workspacePath, tools);
    logger.debug('After node_modules/.bin scan:', { tools: [...tools.entries()] });

    // Then scan workspace-specific tools
    logger.debug('Scanning workspace bin directory...');
    await scanWorkspaceBin(workspacePath, tools);
    logger.debug('After workspace bin scan:', { tools: [...tools.entries()] });

    // Finally scan for global tools
    logger.debug('Scanning for global tools...');
    await scanGlobalBinaries(tools);
    logger.debug('After global tools scan:', { tools: [...tools.entries()] });

    // Update cache
    toolCache.set(workspacePath, {
      tools,
      timestamp: now
    });

    return tools;
  } catch (error) {
    logger.error('Error scanning workspace for tools:', error);
    return new Map();
  }
}

/**
 * Scans package.json for scripts and workspaces
 */
async function scanPackageJson(
  workspacePath: string,
  tools: Map<string, ToolInfo>
): Promise<void> {
  try {
    const pkgPath = join(workspacePath, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent) as PackageJson;

    // Add npm scripts
    if (pkg.scripts) {
      for (const [name, script] of Object.entries(pkg.scripts)) {
        tools.set(`npm:${name}`, {
          name: `npm:${name}`,
          location: pkgPath,
          workingDirectory: workspacePath,
          type: 'npm-script',
          context: {
            scriptSource: pkgPath
          }
        });
      }
    }

    // Scan workspaces if present
    if (pkg.workspaces) {
      for (const pattern of pkg.workspaces) {
        // Note: This is a simplified glob pattern handling
        // In reality, you'd want to use a proper glob matcher
        const workspacePkgPath = join(workspacePath, pattern.replace('/*', ''), 'package.json');
        try {
          await scanPackageJson(dirname(workspacePkgPath), tools);
        } catch (error) {
          logger.debug(`Error scanning workspace package: ${workspacePkgPath}`, error);
        }
      }
    }
  } catch (error) {
    logger.debug('No package.json found or error scanning:', error);
  }
}

/**
 * Scans node_modules/.bin for package tools
 */
async function scanNodeModulesBin(
  workspacePath: string,
  tools: Map<string, ToolInfo>
): Promise<void> {
  const binPath = join(workspacePath, 'node_modules', '.bin');
  try {
    const files = await readdir(binPath, { withFileTypes: true });
    for (const file of files) {
      // Handle both regular files and symlinks
      if ((file.isFile() || file.isSymbolicLink()) && isExecutable(file.name)) {
        const name = process.platform === 'win32'
          ? file.name.replace(/\.[^/.]+$/, '')
          : file.name;
        
        tools.set(name, {
          name,
          location: join('node_modules', '.bin', file.name),
          // Important: Tools in node_modules/.bin should run from workspace root
          workingDirectory: workspacePath,
          type: 'package-bin',
          context: {}
        });
      }
    }
  } catch (error) {
    logger.debug('No node_modules/.bin found or error scanning:', error);
  }
}

/**
 * Scans workspace bin directory for local tools
 */
async function scanWorkspaceBin(
  workspacePath: string,
  tools: Map<string, ToolInfo>
): Promise<void> {
  const binPath = join(workspacePath, 'bin');
  logger.debug('Scanning workspace bin directory:', { binPath, workspacePath });
  try {
    const files = await readdir(binPath, { withFileTypes: true });
    logger.debug('Found files in bin directory:', files.map(f => ({ name: f.name, type: f.isFile() ? 'file' : f.isSymbolicLink() ? 'symlink' : 'other' })));
    
    for (const file of files) {
      // Handle both regular files and symlinks
      if ((file.isFile() || file.isSymbolicLink()) && isExecutable(file.name)) {
        const name = process.platform === 'win32'
          ? file.name.replace(/\.[^/.]+$/, '')
          : file.name;
        
        const location = join(binPath, file.name);
        logger.debug(`Found workspace binary: ${name}`, { 
          name,
          location,
          isFile: file.isFile(),
          isSymlink: file.isSymbolicLink(),
          isExecutable: isExecutable(file.name)
        });
        
        // Don't override tools already found in node_modules/.bin
        if (!tools.has(name)) {
          tools.set(name, {
            name,
            location,
            // Important: Local tools in bin/ should run from workspace root
            workingDirectory: workspacePath,
            type: 'workspace-bin',
            context: {}
          });
          logger.debug(`Added workspace binary to tools:`, tools.get(name));
        } else {
          logger.debug(`Skipping workspace binary (already exists):`, name);
        }
      } else {
        logger.debug(`Skipping non-executable or non-file:`, {
          name: file.name,
          isFile: file.isFile(),
          isSymlink: file.isSymbolicLink(),
          isExecutable: isExecutable(file.name)
        });
      }
    }
  } catch (error) {
    logger.debug('Error scanning workspace bin directory:', { error, binPath });
  }
}

/**
 * Gets info about a specific tool
 * @param workspacePath The workspace path to scan
 * @param toolName Name of the tool to check
 * @returns Promise<ToolInfo | undefined>
 */
export async function getToolInfo(
  workspacePath: string,
  toolName: string
): Promise<ToolInfo | undefined> {
  const tools = await scanWorkspaceTools(workspacePath);
  return tools.get(toolName);
}

/**
 * Gets a list of all available tools in the workspace
 * @param workspacePath The workspace path to scan
 * @returns Promise<ToolInfo[]>
 */
export async function getAvailableTools(
  workspacePath: string
): Promise<ToolInfo[]> {
  const tools = await scanWorkspaceTools(workspacePath);
  return [...tools.values()];
}

/**
 * Clears the tool cache for a specific workspace
 * @param workspacePath The workspace path to clear cache for
 */
export function clearToolCache(workspacePath: string): void {
  toolCache.delete(workspacePath);
}

/**
 * Checks if a binary is available in the workspace
 * @param binaryName Name of the binary to check
 * @param projectPath Path to the project root (defaults to process.cwd())
 * @returns Promise<boolean>
 */
async function isBinaryAvailable(binaryName: string, projectPath: string = process.cwd()): Promise<boolean> {
  try {
    const tools = await scanWorkspaceTools(projectPath);
    return tools.has(binaryName);
  } catch (error) {
    logger.warn(`Error checking binary availability: ${error}`);
    return false;
  }
}

export { isBinaryAvailable }; 