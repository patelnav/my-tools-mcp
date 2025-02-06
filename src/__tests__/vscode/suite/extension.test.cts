const assert = require('assert');
const vscode = require('vscode');

type VSCodeExtension = import('vscode').Extension<any>;

/**
 * Helper function to wait for server to be ready
 * @param {VSCodeExtension} ext
 * @param {number} [timeout]
 * @returns {Promise<number>}
 */
async function waitForServer(ext: VSCodeExtension, timeout = 200): Promise<number> {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] Waiting for server to initialize...`);
    while (Date.now() - start < timeout) {
        const serverPort = ext.exports.getServerPort();
        if (serverPort) {
            console.log(`[${new Date().toISOString()}] Server ready on port ${serverPort} after ${Date.now() - start}ms`);
            return serverPort;
        }
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    console.error(`[${new Date().toISOString()}] Server initialization timed out after ${timeout}ms`);
    throw new Error('Server failed to start within timeout');
}

suite('MCP Tools Extension', () => {
    /** @type {VSCodeExtension} */
    let ext: VSCodeExtension;

    suiteSetup(async function() {
        this.timeout(200);
        console.log(`[${new Date().toISOString()}] Setting up Extension Test Suite`);
        
        // Find and activate extension
        const foundExt = vscode.extensions.getExtension('undefined_publisher.my-tools-mcp');
        if (!foundExt) {
            throw new Error('Extension not found');
        }
        ext = foundExt;
        await ext.activate();
        console.log(`[${new Date().toISOString()}] Extension activated`);
    });

    suiteTeardown(() => {
        console.log(`[${new Date().toISOString()}] Test Suite Teardown`);
    });

    test('Extension activation should start MCP server', async () => {
        if (!ext) {
            throw new Error('Extension not found');
        }
        const serverPort = await waitForServer(ext);
        assert.ok(serverPort > 0, 'Server should be running on a valid port');
        assert.ok(serverPort >= 54321 && serverPort <= 54421, 
            'Server port should be in the MCP range (54321-54421)');
    });

    test('WebView should initialize and discover tools', async function() {
        this.timeout(200);
        if (!ext) {
            throw new Error('Extension not found');
        }

        // Get WebView panel
        const panel = ext.exports.getWebviewPanel();
        assert.ok(panel, 'WebView panel should be created');
        assert.ok(panel.webview, 'WebView should be initialized');
        
        // Wait for initialization sequence
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                disposable.dispose();
                reject(new Error('WebView initialization timed out after 200ms'));
            }, 200);

            let webviewReady = false;
            let workspacePathSent = false;
            let websocketConnected = false;

            const disposable = panel.webview.onDidReceiveMessage(message => {
                // Only log message type, not payload
                if (message.type !== 'TOOLS_DISCOVERED') {
                    console.log(`[Test] Received message type: ${message.type}`);
                }
                
                switch (message.type) {
                    case 'WEBVIEW_READY':
                        webviewReady = true;
                        panel.webview.postMessage({ type: 'WEBVIEW_READY_CONFIRMED' });
                        break;

                    case 'GET_WORKSPACE_PATH':
                        assert.ok(webviewReady, 'WebView should be ready before workspace path is requested');
                        workspacePathSent = true;
                        const serverPort = ext.exports.getServerPort();
                        panel.webview.postMessage({
                            type: 'WORKSPACE_PATH',
                            path: process.cwd(),
                            serverPort: serverPort
                        });
                        break;

                    case 'WEBSOCKET_STATUS':
                        if (message.status === 'connected') {
                            assert.ok(workspacePathSent, 'WebSocket should connect after workspace path is sent');
                            websocketConnected = true;
                        }
                        break;

                    case 'TOOLS_DISCOVERED':
                        try {
                            // Verify correct sequence
                            assert.ok(webviewReady, 'WebView should be ready before tools are discovered');
                            assert.ok(workspacePathSent, 'Workspace path should be sent before tools are discovered');
                            assert.ok(websocketConnected, 'WebSocket should be connected before tools are discovered');
                            
                            // Verify tool data
                            assert.ok(Array.isArray(message.payload), 'Should return array of tools');
                            assert.ok(message.payload.length > 0, 'Should discover at least one tool');
                            
                            const tool = message.payload[0];
                            assert.ok(tool.name, 'Tool should have a name');
                            assert.ok(tool.type, 'Tool should have a type');
                            assert.ok(tool.workingDirectory, 'Tool should have a working directory');

                            clearTimeout(timeout);
                            disposable.dispose();
                            resolve();
                        } catch (err) {
                            clearTimeout(timeout);
                            disposable.dispose();
                            reject(err);
                        }
                        break;
                }
            });
        });
    });
}); 