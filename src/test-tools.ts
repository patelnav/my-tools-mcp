import { getAvailableTools } from './server/controllers/docs/path-scanner';
import { initializeLogging } from '@/utils/logging';
import { getWorkspacePath } from './utils/workspace';
import type { ToolInfo } from '@/types/index';
import { getToolHelpText } from './server/controllers/docs/help-fetcher';
import { join } from 'path';

// Initialize logging without VSCode
initializeLogging(undefined, undefined, true, false);

// Simple logger
function log(message: string, type: 'info' | 'error' | 'warn' = 'info') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}][${type.toUpperCase()}] ${message}`);
}

// Filter configuration
interface FilterConfig {
  types?: string[];
  debug?: boolean;
}

// Helper to create table rows
function createTableRow(cols: string[], widths: number[]): string {
  return '│ ' + cols.map((col, i) => col.padEnd(widths[i])).join(' │ ') + ' │';
}

function createTableSeparator(widths: number[]): string {
  return '├─' + widths.map(w => '─'.repeat(w)).join('─┼─') + '─┤';
}

function createTableHeader(widths: number[]): string {
  return '┌─' + widths.map(w => '─'.repeat(w)).join('─┬─') + '─┐';
}

function createTableFooter(widths: number[]): string {
  return '└─' + widths.map(w => '─'.repeat(w)).join('─┴─') + '─┘';
}

async function testToolHelpText(tool: ToolInfo, workspacePath: string, debug = false): Promise<boolean> {
  try {
    if (debug) {
      log(`Testing help text for ${tool.name}...`);
      log(`Tool details: ${JSON.stringify(tool, null, 2)}`);
    }

    const helpText = await getToolHelpText(tool, workspacePath);
    const hasHelp = helpText.length > 0;
    
    if (debug) {
      log(`Help text length: ${helpText.length} characters`);
      if (hasHelp) {
        log(`First 100 chars: ${helpText.substring(0, 100)}...`);
      } else {
        log('No help text available');
      }
    }

    return hasHelp;
  } catch (error) {
    if (debug) {
      log(`Error getting help text for ${tool.name}: ${error}`, 'error');
    }
    return false;
  }
}

async function main() {
  try {
    const workspacePath = process.cwd();
    console.log(`Scanning workspace: ${workspacePath}`);

    const tools = await getAvailableTools(workspacePath, {
      types: ['global-bin', 'package-bin', 'npm-script'],
      debug: true
    });

    console.log('\nFound tools:');
    tools.forEach(tool => {
      console.log(`- ${tool.name} (${tool.type})`);
      if (tool.location) {
        console.log(`  Location: ${tool.location}`);
      }
      if (tool.workingDirectory) {
        console.log(`  Working Dir: ${tool.workingDirectory}`);
      }
    });

  } catch (error) {
    console.error(`Error scanning tools: ${error}`);
    process.exit(1);
  }
}

main().catch(error => {
  console.error(`Unhandled error: ${error}`);
  process.exit(1);
}); 