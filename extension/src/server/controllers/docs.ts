import { spawn } from 'child_process';
import { DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';

// Simple in-memory cache
const docCache = new Map<string, DocumentationResponse>();

async function getToolVersion(toolName: string, projectPath: string): Promise<string> {
  try {
    const versionText = await new Promise<string>((resolve, reject) => {
      const child = spawn(toolName, ['--version'], {
        cwd: projectPath,
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error || `Failed to get version: Process exited with code ${code}`));
        } else {
          resolve(output.trim());
        }
      });
    });

    return versionText;
  } catch (error) {
    console.warn(`Could not determine version for ${toolName}:`, error);
    return 'unknown';
  }
}

export async function fetchToolDocumentation(tool: ToolSelection): Promise<DocumentationResponse> {
  const cacheKey = `${tool.name}@${tool.projectPath}`;
  
  // Check cache first
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const version = await getToolVersion(tool.name, tool.projectPath);
    const helpText = await new Promise<string>((resolve, reject) => {
      const child = spawn(tool.name, ['-h'], {
        cwd: tool.projectPath,
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error || `Process exited with code ${code}`));
        } else {
          resolve(output);
        }
      });
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
    const errorResponse: DocumentationResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    return errorResponse;
  }
} 