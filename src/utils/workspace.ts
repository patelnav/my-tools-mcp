import type { Tool } from '../types';
import { logError } from '@utils/logging';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Import vscode conditionally since it's only available in VS Code extension host
let vscode: typeof import('vscode') | undefined;
try {
    vscode = require('vscode');
} catch {
    // Module not available, will handle in getWorkspacePath
}

export const enum TestEnvironment {
    NONE = 'none',
    VITEST = 'vitest',
    VSCODE = 'vscode'
}

export function getTestEnvironment(): TestEnvironment {
    if (process.env.VITEST) return TestEnvironment.VITEST;
    if (process.env.VSCODE_TEST === '1') return TestEnvironment.VSCODE;
    return TestEnvironment.NONE;
}

/**
 * Gets the workspace path.
 * In VS Code environment (including tests), uses workspace API.
 * In Vitest tests, uses test-monorepo fixture.
 * In production CLI, uses current working directory.
 */
export function getWorkspacePath(): string {
    const env = getTestEnvironment();
    
    switch (env) {
        case TestEnvironment.VITEST:
            return path.resolve(process.cwd(), 'src/__tests__/fixtures/test-monorepo');
        
        case TestEnvironment.VSCODE:
            // Use VS Code workspace API if available
            if (vscode) {
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (!workspaceFolders?.length) {
                    throw new Error('No workspace folder found');
                }
                return workspaceFolders[0].uri.fsPath;
            }
            // Fall back to test monorepo path if running VS Code tests
            return path.resolve(process.cwd(), 'src/__tests__/fixtures/test-monorepo');
        
        default:
            // Production environment
            return process.cwd();
    }
}

export function validateWorkspacePath(workspacePath: string): string {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
        throw new Error('Invalid workspace path');
    }
    return path.resolve(workspacePath);
}

/**
 * Scans workspace for available tools
 */
export async function scanWorkspaceTools(workspacePath: string): Promise<Map<string, Tool>> {
  const validPath = validateWorkspacePath(workspacePath);
  
  const tools = new Map<string, Tool>();
  
  try {
    // First scan package.json for scripts and workspaces
    await scanPackageJson(validPath, tools);

    // Then scan node_modules/.bin at workspace root
    await scanNodeModulesBin(validPath, tools);

    // Then scan workspace-specific tools
    await scanWorkspaceBin(validPath, tools);

    // Finally scan for global tools
    await scanGlobalBinaries(validPath, tools);

    return tools;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logError(`Error scanning workspace for tools: ${errorMessage}`);
    return new Map();
  }
}

export async function scanPackageJson(validPath: string, tools: Map<string, Tool>): Promise<void> {
  const packageJsonPath = path.join(validPath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    if (packageJson.scripts) {
      for (const [name, script] of Object.entries(packageJson.scripts)) {
        tools.set(`npm:${name}`, {
          name: `npm:${name}`,
          location: packageJsonPath,
          workingDirectory: validPath,
          type: 'npm-script',
          context: { script }
        });
      }
    }
  }
}

export async function scanNodeModulesBin(validPath: string, tools: Map<string, Tool>): Promise<void> {
  const binPath = path.join(validPath, 'node_modules', '.bin');
  if (fs.existsSync(binPath)) {
    const files = fs.readdirSync(binPath);
    for (const file of files) {
      const filePath = path.join(binPath, file);
      if (fs.statSync(filePath).isFile()) {
        // Only add if not already found
        if (!tools.has(file)) {
          tools.set(file, {
            name: file,
            location: path.relative(validPath, filePath),
            workingDirectory: validPath,
            type: 'package-bin',
            context: {}
          });
        }
      }
    }
  }
}

export async function scanWorkspaceBin(validPath: string, tools: Map<string, Tool>): Promise<void> {
  const workspaceBinPath = path.join(validPath, 'bin');
  if (fs.existsSync(workspaceBinPath)) {
    const files = fs.readdirSync(workspaceBinPath);
    for (const file of files) {
      const filePath = path.join(workspaceBinPath, file);
      if (fs.statSync(filePath).isFile()) {
        // Only add if not already found in node_modules/.bin
        if (!tools.has(file)) {
          tools.set(file, {
            name: file,
            location: filePath,
            workingDirectory: validPath,
            type: 'workspace-bin',
            context: {}
          });
        }
      }
    }
  }
}

export async function scanGlobalBinaries(_validPath: string, tools: Map<string, Tool>): Promise<void> {
  const globalTools = ['git', 'node', 'npm', 'yarn', 'pnpm'];
  for (const tool of globalTools) {
    // Only add as global if not already found as a package or workspace tool
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