import { getAvailableTools } from './controllers/docs/path-scanner';
import { getToolHelpText } from './controllers/docs/help-fetcher';
import { isToolExecutable } from './controllers/docs/command-executor';

// Cache structure for storing tool information
interface CachedToolInfo {
  helpText: string;
  isExecutable: boolean;
  lastUpdated: number;
}

// Global cache map keyed by workspace path
const workspaceToolCache = new Map<string, Map<string, CachedToolInfo>>();

/**
 * Cache tools for a specific workspace
 * @param workspacePath Absolute path to workspace
 * @returns Map of cached tool info
 */
export async function cacheWorkspaceTools(workspacePath: string): Promise<Map<string, CachedToolInfo>> {
  const toolCache = new Map<string, CachedToolInfo>();
  
  try {
    // Get all available tools
    const tools = await getAvailableTools(workspacePath, {
      types: ['global-bin', 'package-bin', 'npm-script', 'workspace-bin'],
      debug: true
    });
    
    // Cache each tool's info
    for (const tool of tools) {
      try {
        const [helpText, isExecutable] = await Promise.all([
          getToolHelpText(tool, workspacePath),
          isToolExecutable(tool)
        ]);

        toolCache.set(tool.name, {
          helpText,
          isExecutable,
          lastUpdated: Date.now()
        });
      } catch (error) {
        console.error(`Failed to cache tool ${tool.name}:`, error);
        // Continue with next tool on error
      }
    }
    
    // Update global cache
    workspaceToolCache.set(workspacePath, toolCache);
    return toolCache;
  } catch (error) {
    console.error('Failed to cache workspace tools:', error);
    throw error;
  }
}

/**
 * Get cached tool info for a workspace
 * @param workspacePath Absolute path to workspace
 * @returns Map of cached tool info or undefined if not cached
 */
export function getWorkspaceCache(workspacePath: string): Map<string, CachedToolInfo> | undefined {
  return workspaceToolCache.get(workspacePath);
}

/**
 * Get cached info for a specific tool
 * @param workspacePath Absolute path to workspace
 * @param toolName Name of the tool
 * @returns Cached tool info or undefined if not found
 */
export function getCachedToolInfo(workspacePath: string, toolName: string): CachedToolInfo | undefined {
  const wsCache = workspaceToolCache.get(workspacePath);
  return wsCache?.get(toolName);
}

/**
 * Clear cache for a workspace
 * @param workspacePath Absolute path to workspace
 */
export function clearWorkspaceCache(workspacePath: string): void {
  workspaceToolCache.delete(workspacePath);
}

/**
 * Check if a workspace has cached tools
 * @param workspacePath Absolute path to workspace
 * @returns True if workspace has cached tools
 */
export function hasWorkspaceCache(workspacePath: string): boolean {
  return workspaceToolCache.has(workspacePath);
}

/**
 * Get all cached tool names for a workspace
 * @param workspacePath Absolute path to workspace
 * @returns Array of tool names or empty array if no cache
 */
export function getCachedToolNames(workspacePath: string): string[] {
  const wsCache = workspaceToolCache.get(workspacePath);
  return wsCache ? Array.from(wsCache.keys()) : [];
}

export function isCachePopulated(): boolean {
  return workspaceToolCache.size > 0;
} 