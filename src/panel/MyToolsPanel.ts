import * as vscode from 'vscode';
import { getNonce } from '@/utils/getNonce';

export class MyToolsPanel {
  public static currentPanel: MyToolsPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private _disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;

    // Set the webview's initial html content
    try {
      const webviewContent = this._getHtmlForWebview(this._panel.webview, extensionUri);
      console.log('Initializing WebView with content length:', webviewContent.length);
      this._panel.webview.html = webviewContent;
    } catch (error) {
      console.error('Error initializing WebView:', error);
      vscode.window.showErrorMessage('Failed to initialize MCP Tools panel');
    }

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      message => {
        console.log('Received message from WebView:', message);
        switch (message.type) {
          case 'GET_WORKSPACE_PATH':
            const workspaceFolders = vscode.workspace.workspaceFolders;
            console.log('Workspace folders:', workspaceFolders);
            if (workspaceFolders && workspaceFolders.length > 0) {
              const path = workspaceFolders[0].uri.fsPath;
              console.log('Sending workspace path:', path);
              this._panel.webview.postMessage({
                type: 'WORKSPACE_PATH',
                path
              });
            } else {
              console.log('No workspace folders found');
              this._panel.webview.postMessage({
                type: 'WORKSPACE_PATH',
                path: process.cwd() // Fallback to current working directory
              });
            }
            return;
          case 'error':
            vscode.window.showErrorMessage(message.value);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (MyToolsPanel.currentPanel) {
      MyToolsPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'mcpTools',
      'MCP Tools',
      column || vscode.ViewColumn.One,
      {
        // Enable javascript in the webview
        enableScripts: true,
        // Restrict the webview to only load resources from the `dist` directory
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    MyToolsPanel.currentPanel = new MyToolsPanel(panel, extensionUri);
  }

  private _getHtmlForWebview(webview: vscode.Webview, extensionUri: vscode.Uri) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'panel.js')
    );

    console.log('Script URI:', scriptUri.toString());

    const nonce = getNonce();

    // Security: Strict Content Security Policy
    const csp = `
      default-src 'none';
      style-src ${webview.cspSource} 'unsafe-inline';
      script-src 'nonce-${nonce}' ${webview.cspSource};
      connect-src ws://localhost:* wss://localhost:* http://localhost:* https://localhost:*;
      img-src ${webview.cspSource} https:;
      font-src ${webview.cspSource};
      object-src 'none';
      media-src 'none';
      frame-src 'none';
      form-action 'none';
      base-uri 'none';
      child-src 'none';
      worker-src 'none';
    `.replace(/\s+/g, ' ').trim();

    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        <title>MCP Tools</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
        <script nonce="${nonce}">
          console.log('WebView initialized');
          
          // Add WebSocket connection status to window
          window.wsStatus = {
            isConnecting: false,
            retryCount: 0,
            maxRetries: 5,
            retryDelay: 1000,
            lastError: null,
            connected: false
          };

          window.onerror = function(message, source, lineno, colno, error) {
            console.error('WebView error:', {message, source, lineno, colno, error});
            if (window.wsStatus) {
              window.wsStatus.lastError = error;
            }
            return false;
          };

          // Add connection status change handler
          window.addEventListener('ws-status-change', function(e) {
            console.log('WebSocket status changed:', e.detail);
          });
        </script>
      </body>
      </html>`;
  }

  public dispose() {
    MyToolsPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }
} 