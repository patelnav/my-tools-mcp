import * as vscode from 'vscode';
import * as assert from 'assert';

function log(message: string) {
    console.log(`[Tool Discovery Test] ${message}`);
}

suite('Tool Discovery', function() {
    // Use function() instead of arrow function to preserve this context
    this?.timeout(15000); // Optional chaining to handle possible undefined

    test('should activate the extension', async function() {
        log('Starting extension activation test');
        const ext = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
        if (!ext) {
            log('Extension not found');
            throw new Error('Extension not found');
        }
        log('Extension found, activating...');
        const exports = await ext.activate();
        assert.ok(ext.isActive, 'Extension should be active');
        assert.ok(exports, 'Extension should return exports object');
        assert.ok(typeof exports.getWebviewPanel === 'function', 'Exports should have getWebviewPanel function');
        log('Extension activated successfully');
    });

    test('should open MCP Tools panel and discover tools', async function() {
        log('Starting tool discovery test');
        
        // Get extension instance
        const ext = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
        if (!ext) {
            throw new Error('Extension not found');
        }
        if (!ext.isActive) {
            log('Extension not active, activating...');
            await ext.activate();
        }
        
        // Verify exports are available
        if (!ext.exports) {
            log('Extension exports is undefined');
            throw new Error('Extension exports is undefined');
        }
        log(`Extension exports keys: ${Object.keys(ext.exports)}`);
        
        // Create a promise that will resolve when tools are discovered
        const toolDiscoveryPromise = new Promise<void>((resolve, reject) => {
            log('Setting up tool discovery promise');
            const timeout = setTimeout(() => {
                log('Tool discovery timed out after 10000ms');
                reject(new Error('Tool discovery timed out'));
            }, 10000);

            // Track the WebSocket connection status
            let isWebSocketConnected = false;
            let panel: vscode.WebviewPanel | undefined;

            // Set up message listener before opening panel
            const messageListener = (message: any) => {
                log(`Received message from WebView: ${JSON.stringify(message)}`);
                
                // First, the WebView will request the workspace path
                if (message.type === 'GET_WORKSPACE_PATH') {
                    log('Received GET_WORKSPACE_PATH request');
                    // After sending workspace path, server should start sharing
                    panel?.webview.postMessage({
                        type: 'WORKSPACE_PATH',
                        path: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd()
                    });
                }

                // Track WebSocket connection status
                if (message.type === 'WEBSOCKET_STATUS') {
                    log(`WebSocket status: ${message.status}`);
                    if (message.status === 'connected') {
                        isWebSocketConnected = true;
                        log('WebSocket connected successfully');
                    } else if (message.status === 'error') {
                        log(`WebSocket error: ${message.error}`);
                        clearTimeout(timeout);
                        cleanup();
                        reject(new Error(`WebSocket connection failed: ${message.error}`));
                    }
                }
                
                // After WebSocket connection is established, tools will be discovered
                if (message.type === 'AVAILABLE_TOOLS') {
                    if (!isWebSocketConnected) {
                        log('Received tools before WebSocket connection was established');
                        return;
                    }
                    
                    const tools = message.commands || [];
                    log(`Found ${tools.length} tools`);
                    assert.ok(tools.length > 0, 'Should discover at least one tool');
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                }
            };

            const cleanup = () => {
                if (panel) {
                    panel.dispose();
                }
            };

            // Now open the MCP Tools panel
            log('Opening MCP Tools panel');
            Promise.resolve(vscode.commands.executeCommand('mcpTools.openPanel'))
                .then(async () => {
                    log('MCP Tools panel opened');
                    
                    // Wait a bit for the panel to be fully initialized
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Get the panel through the extension's exports
                    log('Getting panel from extension exports');
                    panel = ext.exports.getWebviewPanel();
                    if (!panel) {
                        log('Panel not found in extension exports');
                        // Try finding it through visible editors as fallback
                        const panels = vscode.window.visibleTextEditors
                            .filter(editor => editor.document.uri.scheme === 'vscode-webview')
                            .map(editor => editor.document.uri);
                        
                        log(`Found ${panels.length} webview panels`);
                        if (panels.length === 0) {
                            throw new Error('MCP Tools panel not found');
                        }
                        
                        // Since we found panels but couldn't get the panel from exports,
                        // something is wrong with our setup
                        throw new Error('Could not access MCP Tools panel');
                    }
                    
                    log('Successfully got panel from extension exports');
                    
                    // Set up message listener
                    panel.webview.onDidReceiveMessage(messageListener);
                })
                .catch((error: Error) => {
                    log(`Error opening MCP Tools panel: ${error}`);
                    clearTimeout(timeout);
                    cleanup();
                    reject(error);
                });
        });

        // Wait for tool discovery to complete
        await toolDiscoveryPromise;
        log('Tool discovery completed successfully');
    });
}); 