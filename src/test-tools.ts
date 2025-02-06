import { getAvailableTools } from './server/controllers/docs/path-scanner';
import { getWorkspacePath } from './utils/workspace';
import type { ToolInfo } from '@/types/index';
import { getToolHelpText } from './server/controllers/docs/help-fetcher';

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
    const filters: FilterConfig = {
      types: [],
      debug: true // Enable detailed logging
    };

    // Get workspace path (current repo)
    const workspacePath = getWorkspacePath();
    log(`Using workspace path: ${workspacePath}`);

    // Get available tools with filters
    log('Fetching available tools...');
    const tools = await getAvailableTools(workspacePath, {
      types: filters.types,
      debug: filters.debug
    });
    
    if (filters.debug) {
      log(`Total tools found: ${tools.length}`);
    }

    // Test help text retrieval for each tool
    log('\nTesting help text retrieval:');
    
    // Collect results
    const results = await Promise.all(tools.map(async tool => {
      const hasHelp = await testToolHelpText(tool, workspacePath, filters.debug);
      return {
        name: tool.name,
        type: tool.type,
        hasHelp,
        location: tool.location || 'N/A',
        workingDir: tool.workingDirectory || 'N/A'
      };
    }));

    // Define column widths
    const colWidths = [30, 15, 10, 40, 40];
    
    // Print table header
    console.log('\nTool Documentation Status:');
    console.log(createTableHeader(colWidths));
    console.log(createTableRow(['Name', 'Type', 'Has Help', 'Location', 'Working Directory'], colWidths));
    console.log(createTableSeparator(colWidths));

    // Print results
    results.forEach(result => {
      console.log(createTableRow([
        result.name,
        result.type,
        result.hasHelp ? '✅' : '❌',
        result.location,
        result.workingDir
      ], colWidths));
    });

    // Print table footer
    console.log(createTableFooter(colWidths));

    // Print statistics
    const helpSuccessCount = results.filter(r => r.hasHelp).length;
    console.log(`\nStatistics:`);
    console.log(`Total tools found: ${results.length}`);
    console.log(`Tools with help text: ${helpSuccessCount}/${results.length}`);
    
    // Print type breakdown
    const typeStats = results.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\nBreakdown by type:');
    Object.entries(typeStats).forEach(([type, count]) => {
      const helpCount = results.filter(r => r.type === type && r.hasHelp).length;
      console.log(`${type}: ${helpCount}/${count} have help text`);
    });

  } catch (error) {
    log(`Error: ${error}`, 'error');
    process.exit(1);
  }
}

main(); 