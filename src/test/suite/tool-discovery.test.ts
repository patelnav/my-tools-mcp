import * as vscode from 'vscode';
import * as assert from 'assert';

// Logging utilities
function logHeader(message: string) {
    console.log('\n=== ' + message + ' ===');
}

function logStep(message: string) {
    console.log('  → ' + message);
}

function logSuccess(message: string) {
    console.log('  ✓ ' + message);
}

function logWarning(message: string) {
    console.log('  ⚠ ' + message);
}

function logError(message: string) {
    console.log('  ✗ ' + message);
}

// Helper function to wait for server to be ready
async function waitForServer(ext: vscode.Extension<any>, timeout = 30000): Promise<number> {
    const start = Date.now();
    logStep('Waiting for server to initialize...');
    while (Date.now() - start < timeout) {
        const serverPort = ext.exports.getServerPort();
        if (serverPort) {
            logSuccess(`Server ready on port ${serverPort}`);
            return serverPort;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    logError('Server initialization timed out');
    throw new Error('Server not initialized within timeout');
}

// Helper function to format tool info
function formatTool(tool: any): string {
    return [
        `  • ${tool.command}`,
        `    Description: ${tool.description}`,
        `    Type: ${tool.type}${tool.group ? `, Group: ${tool.group}` : ''}\n`
    ].join('\n');
}

// Helper function to group tools by type
function groupTools(tools: any[]): { [key: string]: any[] } {
    return tools.reduce((acc, tool) => {
        const type = tool.type;
        if (!acc[type]) {
            acc[type] = [];
        }
        acc[type].push(tool);
        return acc;
    }, {});
}

suite('Tool Discovery', function() {
    this.timeout(45000);

    test('should activate the extension', async () => {
        logHeader('Extension Activation Test');
        const ext = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
        if (!ext) {
            logError('Extension not found');
            throw new Error('Extension not found');
        }
        logStep('Extension found, activating...');
        const exports = await ext.activate();
        logSuccess('Extension activated');
        assert.ok(ext.isActive, 'Extension should be active');
        assert.ok(exports, 'Extension should return exports object');
        assert.ok(typeof exports.getWebviewPanel === 'function', 'Exports should have getWebviewPanel function');
    });

    test('should open MCP Tools panel and discover tools', async () => {
        logHeader('Tool Discovery Test');
        
        // Get extension instance
        const ext = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
        if (!ext) {
            logError('Extension not found');
            throw new Error('Extension not found');
        }
        if (!ext.isActive) {
            logStep('Extension not active, activating...');
            await ext.activate();
        }
        
        if (!ext.exports) {
            logError('Extension exports is undefined');
            throw new Error('Extension exports is undefined');
        }

        const toolDiscoveryPromise = new Promise<void>((resolve, reject) => {
            logStep('Setting up tool discovery');
            const timeout = setTimeout(() => {
                logError('Tool discovery timed out after 30s');
                reject(new Error('Tool discovery timed out'));
            }, 30000);

            let hasTools = false;
            let isConnected = false;
            let panel: vscode.WebviewPanel | undefined;

            function checkSuccess() {
                if (hasTools && isConnected) {
                    clearTimeout(timeout);
                    cleanup();
                    resolve();
                }
            }

            const cleanup = () => {
                if (panel) {
                    panel.dispose();
                }
            };

            const messageListener = async (message: any) => {
                // Handle workspace path request
                if (message.type === 'GET_WORKSPACE_PATH') {
                    logStep('Processing workspace path request');
                    try {
                        const serverPort = await waitForServer(ext);
                        logSuccess('Server connection established');
                        panel?.webview.postMessage({
                            type: 'WORKSPACE_PATH',
                            path: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd(),
                            serverPort
                        });
                    } catch (error) {
                        logError(`Server connection failed: ${error}`);
                        reject(error);
                    }
                }

                // Track WebSocket connection status
                if (message.type === 'WEBSOCKET_STATUS') {
                    if (message.status === 'connected') {
                        isConnected = true;
                        logSuccess('WebSocket connected');
                        checkSuccess();
                    } else if (message.status === 'error') {
                        logError(`WebSocket error: ${message.error}`);
                        reject(new Error(`WebSocket connection failed: ${message.error}`));
                    }
                }
                
                // Check for tools
                if (message.type === 'AVAILABLE_TOOLS') {
                    const tools = message.commands || [];
                    if (tools.length > 0) {
                        hasTools = true;
                        logSuccess(`Discovered ${tools.length} tools`);
                        
                        // Group tools by type and display a summary
                        const groupedTools = groupTools(tools);
                        console.log('\nTool Discovery Summary:');
                        Object.entries(groupedTools).forEach(([type, typeTools]) => {
                            console.log(`\n${type.toUpperCase()} (${typeTools.length} tools):`);
                            // Show first 2 tools of each type as examples
                            typeTools.slice(0, 2).forEach(tool => {
                                console.log(formatTool(tool));
                            });
                            if (typeTools.length > 2) {
                                console.log(`  ... and ${typeTools.length - 2} more ${type} tools\n`);
                            }
                        });
                        
                        checkSuccess();
                    } else {
                        logWarning('No tools discovered');
                    }
                }
            };

            logStep('Opening MCP Tools panel');
            Promise.resolve(vscode.commands.executeCommand('mcpTools.openPanel'))
                .then(async () => {
                    logSuccess('MCP Tools panel opened');
                    panel = ext.exports.getWebviewPanel();
                    if (!panel) {
                        logError('Could not access MCP Tools panel');
                        throw new Error('Could not access MCP Tools panel');
                    }
                    panel.webview.onDidReceiveMessage(messageListener);
                })
                .catch((error: Error) => {
                    logError(`Failed to open MCP Tools panel: ${error}`);
                    reject(error);
                });
        });

        await toolDiscoveryPromise;
        logSuccess('Tool discovery completed successfully');
    });
}); 