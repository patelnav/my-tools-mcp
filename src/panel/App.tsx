/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { 
  DocumentationResponse, 
  ToolSelection, 
  Command,
  VSCodeMessage,
  WebSocketMessage,
  WorkspacePathMessage,
  DiscoverToolsMessage,
  ToolsDiscoveredMessage,
  DocumentationUpdatedMessage,
  ErrorMessage,
  WebSocketStatusMessage,
  HelloResponseMessage,
  GetWorkspacePathMessage
} from '@/types/types';
import { cn } from '@/utils/cn';
import { ToolSelector } from './components/ToolSelector';
import { LoadingState } from './components/LoadingState';
import { useWebSocket } from './hooks/useWebSocket';
import './index.css';

interface AppProps {
  vscode: {
    postMessage: (message: VSCodeMessage) => void;
    getState: () => any;
  };
}

export function App({ vscode }: AppProps) {
  const [projectPath, setProjectPath] = useState('');
  const [serverPort, setServerPort] = useState<number>();
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  
  const { 
    ws, 
    isConnected, 
    error, 
    availableTools,
    documentation 
  } = useWebSocket({
    serverPort,
    workspacePath: projectPath,
    vscode
  });

  // Initialize WebView
  useEffect(() => {
    console.log('[App] Initializing WebView');
    vscode.postMessage({ type: 'WEBVIEW_READY' });
  }, [vscode]);

  // Request workspace path after WebView is ready
  useEffect(() => {
    if (!isWebViewReady) return;
    console.log('[App] Requesting workspace path');
    vscode.postMessage({ type: 'GET_WORKSPACE_PATH' });
  }, [isWebViewReady, vscode]);

  // Handle VS Code messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      const message = event.data;
      // Only log message type, not the full payload
      console.log('[App] Received message type:', message.type);

      switch (message.type) {
        case 'WEBVIEW_READY_CONFIRMED':
          setIsWebViewReady(true);
          break;
        case 'WORKSPACE_PATH':
          setProjectPath(message.path);
          setServerPort(message.serverPort);
          break;
        case 'HELLO':
          vscode.postMessage({ type: 'HELLO_RESPONSE', text: 'Hello from WebView!' });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode]);

  const handleToolSelect = (tool: ToolSelection) => {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'SELECT_TOOL', payload: tool }));
    }
  };

  if (!isWebViewReady || !serverPort) {
    return <LoadingState />;
  }

  if (error) {
    return <LoadingState error={error} />;
  }

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP Tools Documentation</h1>
        <div className={cn(
          "mt-2 px-3 py-1 rounded text-sm",
          isConnected 
            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" 
            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
        )}>
          {isConnected ? (
            <>Connected to MCP server {availableTools.length > 0 && `(${availableTools.length} tools available)`}</>
          ) : "Disconnected"}
        </div>
      </header>

      <div className="space-y-6">
        <section className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Available Tools</h2>
          <ToolSelector 
            onSelect={handleToolSelect} 
            isConnected={isConnected} 
            tools={availableTools}
            projectPath={projectPath}
          />
        </section>

        {documentation?.success && documentation.data && (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {documentation.data.name}
              </h2>
              {documentation.data.version && (
                <span className="text-sm text-gray-500">v{documentation.data.version}</span>
              )}
              <span className="animate-pulse bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs px-2 py-1 rounded">
                Updated
              </span>
            </div>
            <div className="relative">
              <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded overflow-auto font-mono text-sm text-gray-900 dark:text-gray-100">
                {documentation.data.helpText}
              </pre>
              <button 
                onClick={() => {
                  if (documentation.data?.helpText) {
                    navigator.clipboard.writeText(documentation.data.helpText);
                    const button = document.getElementById('copy-button');
                    if (button) {
                      button.textContent = 'Copied!';
                      setTimeout(() => {
                        button.textContent = 'Copy';
                      }, 2000);
                    }
                  }
                }}
                id="copy-button"
                className="absolute top-2 right-2 px-3 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Copy
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(documentation.data.lastUpdated).toLocaleString()}
            </p>
          </section>
        )}
      </div>
    </div>
  );
} 