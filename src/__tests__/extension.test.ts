import { runTests } from '@vscode/test-electron';
import * as path from 'path';
import * as vscode from 'vscode';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to test runner
    const extensionTestsPath = path.resolve(__dirname, './suite');

    // Test workspace with known tools
    const testWorkspace = path.resolve(__dirname, '../fixtures/test-monorepo');

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        testWorkspace,
        '--disable-extensions', // Disable other extensions
        '--verbose' // Enable verbose logging
      ]
    });
  } catch (err) {
    console.error('Failed to run tests:', err);
    process.exit(1);
  }
}

// Only run the download/setup when executed directly
if (require.main === module) {
  main();
}

// Test suite
describe('MCP Tools Extension', () => {
  let panel: vscode.WebviewPanel | undefined;

  beforeAll(async () => {
    // Wait for extension to be activated
    const ext = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
    if (!ext) {
      throw new Error('Extension not found. Make sure it is properly packaged and registered.');
    }
    
    if (!ext.isActive) {
      await ext.activate();
    }
  });

  afterAll(async () => {
    if (panel) {
      panel.dispose();
    }
  });

  it('should discover and list available tools', async () => {
    // Open the MCP Tools panel
    await vscode.commands.executeCommand('mcpTools.openPanel');

    // Wait for the panel to be created with timeout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for WebView panel'));
      }, 5000);

      const disposable = vscode.window.registerWebviewPanelSerializer('mcpTools', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
          panel = webviewPanel;
          disposable.dispose();
          clearTimeout(timeout);
          resolve();
        }
      });
    });

    expect(panel).toBeDefined();
    
    if (!panel) {
      throw new Error('WebView panel was not created');
    }

    // Wait for tools to be discovered with timeout
    const toolsPromise = new Promise<any>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for tools discovery'));
      }, 5000);

      const messageHandler = (message: any) => {
        if (message.type === 'AVAILABLE_TOOLS') {
          panel?.webview.onDidReceiveMessage(messageHandler);
          clearTimeout(timeout);
          resolve(message);
        }
      };

      panel?.webview.onDidReceiveMessage(messageHandler);
      panel?.webview.postMessage({ type: 'GET_AVAILABLE_TOOLS' });
    });

    const toolsMessage = await toolsPromise;
    expect(toolsMessage).toBeDefined();
    expect(toolsMessage.commands).toBeDefined();
    expect(toolsMessage.commands.length).toBeGreaterThan(0);

    // Log discovered tools
    console.log('Discovered tools:', toolsMessage.commands);
  });
}); 