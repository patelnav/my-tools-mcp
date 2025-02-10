const assert = require('assert');
const vscode = require('vscode');

type VSCodeExtension = import('vscode').Extension<any>;

/**
 * Helper function to wait for server to be ready
 * @param {VSCodeExtension} ext
 * @param {number} [timeout]
 * @returns {Promise<number>}
 */
async function waitForServer(ext: VSCodeExtension, timeout = 1000): Promise<number> {
    const start = Date.now();
    console.log(`[${new Date().toISOString()}] Waiting for server to initialize...`);
    while (Date.now() - start < timeout) {
        const serverPort = ext.exports.getServerPort();
        if (serverPort) {
            // Also check server health
            const isHealthy = await ext.exports.checkServerHealth();
            if (isHealthy) {
                console.log(`[${new Date().toISOString()}] Server ready and healthy on port ${serverPort} after ${Date.now() - start}ms`);
                return serverPort;
            }
            console.log(`[${new Date().toISOString()}] Server port ${serverPort} available but not yet healthy`);
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.error(`[${new Date().toISOString()}] Server initialization timed out after ${timeout}ms`);
    throw new Error('Server failed to start within timeout');
}

suite('MCP Tools Extension', () => {
    /** @type {VSCodeExtension} */
    let ext: VSCodeExtension;

    suiteSetup(async function() {
        this.timeout(2000);
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

    test('Extension activation should start server', async () => {
        if (!ext) {
            throw new Error('Extension not found');
        }
        const serverPort = ext.exports.getServerPort();
        assert.ok(serverPort > 0, 'Server should be running on a valid port');
        assert.ok(serverPort >= 54321 && serverPort <= 54421, 
            'Server port should be in the MCP range (54321-54421)');
    });

    test('WebView should show server status', async function() {
        this.timeout(5000);
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
                reject(new Error('WebView initialization timed out after 5000ms'));
            }, 5000);

            let webviewReady = false;
            let serverPort = ext.exports.getServerPort();

            const disposable = panel.webview.onDidReceiveMessage(message => {
                console.log(`[Test] Received message type: ${message.type}`);
                
                switch (message.type) {
                    case 'WEBVIEW_READY':
                        webviewReady = true;
                        panel.webview.postMessage({ type: 'WEBVIEW_READY_CONFIRMED' });
                        break;

                    case 'MCP_STATUS':
                        assert.ok(webviewReady, 'WebView should be ready before server status is received');
                        assert.equal(message.status, 'connected', 'Server status should be connected');
                        clearTimeout(timeout);
                        disposable.dispose();
                        resolve();
                        break;
                }
            });
        });
    });
}); 