/**
 * Tool Scanner Module
 * 
 * Scans workspace to discover available command-line tools.
 * Works in conjunction with package-scanner.ts to provide comprehensive tool discovery.
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { env } from '@/env';
import { getWorkspacePath } from '@/utils/workspace';
import { readFileSync } from 'fs';
import { type ToolInfo } from '@/types/index';
import { promisify } from 'util';
import { execFile as execFileCb } from 'child_process';
import * as fs from 'fs/promises';
import { logTools, logDebug } from '@/utils/logging';

const execFile = promisify(execFileCb);

// Cache of scanned tools per workspace
const toolCache = new Map<string, { tools: Map<string, ToolInfo>, timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Helper function for logging objects
function logObject(prefix: string, obj: unknown) {
  logTools(`${prefix}: ${JSON.stringify(obj, null, 2)}`);
}

export interface ToolScannerOptions {
  types?: string[];
  categories?: string[];
  debug?: boolean;
}

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  bin?: Record<string, string> | string;
  workspaces?: string[] | { packages: string[] };
}

/**
 * Checks if a file is executable based on its extension and platform
 * @param filename Name of the file to check
 * @returns boolean
 */
function isExecutable(filename: string): boolean {
  logDebug('Tools', `Checking if file is executable: ${filename} (${process.platform})`);
  if (process.platform === 'win32') {
    const result = env.executableExtensions.some(ext => filename.toUpperCase().endsWith(ext));
    logDebug('Tools', `Windows executable check: ${filename} -> ${result}`);
    return result;
  }
  logDebug('Tools', 'Unix executable check - assuming true');
  return true; // On Unix, we trust the file permissions (handled by readdir)
}

/**
 * Scans PATH for globally available tools
 */
async function scanGlobalBinaries(
  tools: Map<string, ToolInfo>,
  workspacePath: string
): Promise<void> {
  const globalTools = ['git', 'node', 'npm', 'yarn', 'pnpm'];
  logTools(`Scanning for global tools: ${globalTools.join(', ')}`);
  
  // First check if any of these tools exist in the workspace bin directory
  const binPath = join(workspacePath, 'bin');
  try {
    const files = await readdir(binPath, { withFileTypes: true });
    for (const file of files) {
      if ((file.isFile() || file.isSymbolicLink()) && isExecutable(file.name)) {
        const name = process.platform === 'win32'
          ? file.name.replace(/\.[^/.]+$/, '')
          : file.name;
        
        if (globalTools.includes(name)) {
          tools.set(name, {
            name,
            location: join(binPath, file.name),
            workingDirectory: workspacePath,
            type: 'workspace-bin',
            context: {}
          });
          logTools(`Found global tool in workspace: ${name}`);
        }
      }
    }
  } catch (error) {
    logTools(`Error scanning workspace bin for global tools: ${error}`, 'warn');
  }
  
  // Then add any remaining tools as global
  for (const tool of globalTools) {
    // Don't override tools already found in workspace
    if (!tools.has(tool)) {
      tools.set(tool, {
        name: tool,
        type: 'global-bin',
        workingDirectory: getWorkspacePath(),
        context: {}
      });
      logTools(`Added global tool: ${tool}`);
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
  logTools(`Scanning workspace for tools: ${workspacePath}`);
  
  // Check cache first
  const now = Date.now();
  const cached = toolCache.get(workspacePath);
  
  if (cached && (now - cached.timestamp < CACHE_TTL)) {
    const toolCount = cached.tools.size;
    logTools('Using cached tools', { toolCount });
    return cached.tools;
  }

  const tools = new Map<string, ToolInfo>();
  
  try {
    logTools('Scanning package.json...');
    await scanPackageJson(workspacePath, tools);
    logTools('Package.json scan complete', { toolCount: tools.size });

    logTools('Scanning node_modules/.bin...');
    await scanNodeModulesBin(workspacePath, tools);
    logTools('Node modules scan complete', { toolCount: tools.size });

    logTools('Scanning workspace bin directory...');
    await scanWorkspaceBin(workspacePath, tools);
    logTools('Workspace bin scan complete', { toolCount: tools.size });

    logTools('Scanning for global tools...');
    await scanGlobalBinaries(tools, workspacePath);
    logTools('Global tools scan complete', { toolCount: tools.size });

    // Update cache
    toolCache.set(workspacePath, {
      tools,
      timestamp: now
    });
    logTools('Updated tool cache', { totalTools: tools.size });

    return tools;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logTools('Error scanning workspace for tools', { error: errorMessage });
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
            scriptSource: pkgPath,
            script
          }
        });
      }
    }

    // Scan workspaces if present
    if (pkg.workspaces) {
      const patterns = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages;
      for (const pattern of patterns) {
        // Note: This is a simplified glob pattern handling
        // In reality, you'd want to use a proper glob matcher
        const workspacePkgPath = join(workspacePath, pattern.replace('/*', ''), 'package.json');
        try {
          await scanPackageJson(dirname(workspacePkgPath), tools);
        } catch (error) {
          logTools(`Error scanning workspace package: ${workspacePkgPath}`, 'warn');
        }
      }
    }
  } catch (error) {
    logTools('No package.json found or error scanning:', error);
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
    logTools('No node_modules/.bin found or error scanning:', error);
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
  logTools('Scanning workspace bin directory:');
  try {
    const files = await readdir(binPath, { withFileTypes: true });
    logTools('Found files in bin directory:');
    logObject('Found files in bin directory', files.map(f => ({ 
      name: f.name, 
      type: f.isFile() ? 'file' : f.isSymbolicLink() ? 'symlink' : 'other',
      isExecutable: isExecutable(f.name)
    })));
    
    for (const file of files) {
      // Handle both regular files and symlinks
      if ((file.isFile() || file.isSymbolicLink()) && isExecutable(file.name)) {
        const name = process.platform === 'win32'
          ? file.name.replace(/\.[^/.]+$/, '')
          : file.name;
        
        const location = join(binPath, file.name);
        logTools(`Found workspace binary: ${name}`, { 
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
          logTools(`Added workspace binary to tools:`, tools.get(name));
        } else {
          logTools(`Skipping workspace binary (already exists):`, name);
        }
      } else {
        logTools(`Skipping non-executable or non-file:`, {
          name: file.name,
          isFile: file.isFile(),
          isSymlink: file.isSymbolicLink(),
          isExecutable: isExecutable(file.name)
        });
      }
    }
  } catch (error) {
    logTools('Error scanning workspace bin directory:', { error, binPath });
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
 * Get all available tools in a workspace
 * @param workspacePath Path to workspace root
 * @param options Optional scanner configuration
 * @returns Array of tool info objects
 */
export async function getAvailableTools(
  workspacePath: string,
  options: ToolScannerOptions = {}
): Promise<ToolInfo[]> {
  logTools(`Starting tool discovery in workspace: ${workspacePath}`);
  
  const tools: ToolInfo[] = [];
  const { types = [] } = options;

  try {
    // Only scan if no type filter or 'npm-script' is included
    if (!types.length || types.includes('npm-script')) {
      logTools('Scanning for npm scripts...');
      const packageJsonPath = join(workspacePath, 'package.json');
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const scripts = packageJson.scripts || {};
        
        for (const [name, script] of Object.entries(scripts)) {
          tools.push({
            name: `npm:${name}`,
            type: 'npm-script',
            workingDirectory: workspacePath,
            context: { script }
          });
        }
        logTools(`Found ${Object.keys(scripts).length} npm scripts`);
      } catch (error) {
        logTools('No package.json found or invalid format');
      }
    }

    // Only scan if no type filter or 'package-bin' is included
    if (!types.length || types.includes('package-bin')) {
      logTools('Scanning node_modules/.bin directory...');
      const nodeModulesBinPath = join(workspacePath, 'node_modules', '.bin');
      try {
        const binFiles = await readdir(nodeModulesBinPath, { withFileTypes: true });
        let executableCount = 0;
        for (const file of binFiles) {
          const fullPath = join(nodeModulesBinPath, file.name);
          if (file.isFile()) {
            const stats = await fs.stat(fullPath);
            if (stats.mode & 0o111) { // Check if executable
              tools.push({
                name: file.name,
                type: 'package-bin',
                location: fullPath,
                workingDirectory: workspacePath
              });
              executableCount++;
            }
          }
        }
        logTools(`Found ${executableCount} package binaries`);
      } catch (error) {
        logTools('No node_modules/.bin directory found');
      }
    }

    // Only scan if no type filter or 'global-bin' is included
    if (!types.length || types.includes('global-bin')) {
      const commonTools = ['git', 'node', 'npm', 'yarn', 'pnpm'];
      logTools('Scanning for global tools:', commonTools);
      let globalToolCount = 0;
      for (const tool of commonTools) {
        try {
          const result = await execFile('which', [tool]);
          if (result.stdout) {
            tools.push({
              name: tool,
              type: 'global-bin',
              workingDirectory: workspacePath
            });
            globalToolCount++;
            logTools(`Found global tool: ${tool}`);
          }
        } catch (error) {
          // Tool not found, skip
        }
      }
      logTools(`Found ${globalToolCount} global tools`);
    }

    logObject('Tool discovery completed', {
      total: tools.length,
      byType: tools.reduce((acc, tool) => {
        acc[tool.type] = (acc[tool.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    return tools;
  } catch (error) {
    logTools('Error scanning workspace:', error);
    throw error;
  }
}

/**
 * Clears the tool cache for a specific workspace
 * @param workspacePath The workspace path to clear cache for
 */
export function clearToolCache(workspacePath: string): void {
  toolCache.delete(workspacePath);
}

/**
 * Check if a binary is available in the workspace
 * @param binaryName Name of binary to check
 * @param projectPath Optional project path, defaults to workspace path
 * @returns Promise<boolean>
 */
export async function isBinaryAvailable(binaryName: string, projectPath?: string): Promise<boolean> {
  try {
    const tools = await scanWorkspaceTools(projectPath || getWorkspacePath());
    return tools.has(binaryName);
  } catch (error) {
    logTools(`Error checking binary availability: ${error}`);
    return false;
  }
}