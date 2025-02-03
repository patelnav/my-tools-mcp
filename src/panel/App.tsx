import React, { useEffect, useState } from 'react';
import { DocumentationResponse, ToolSelection, Command } from '@/types/types';
import { cn } from '@/utils/cn';
import { ToolSelector } from './components/ToolSelector';

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
  getState: () => any;
};

// Acquire VS Code API once at the module level
const vscode = acquireVsCodeApi();

export function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [availableTools, setAvailableTools] = useState<Command[]>([]);

  useEffect(() => {
    console.log('Requesting workspace path...');
    vscode.postMessage({ type: 'GET_WORKSPACE_PATH' });

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message:', message);
      
      if (message.type === 'WORKSPACE_PATH') {
        console.log('Setting project path to:', message.path);
        // Now that we have the workspace path and server port, try to connect
        const socket = new WebSocket(`ws://localhost:${message.serverPort}`);

        socket.onopen = () => {
          console.log('Connected to MCP server');
          setWs(socket);
          setIsConnected(true);
          setError(null);
          
          // Send connection status to extension
          vscode.postMessage({
            type: 'WEBSOCKET_STATUS',
            status: 'connected'
          });
          
          // Request available tools once connected
          socket.send(JSON.stringify({
            type: 'GET_AVAILABLE_TOOLS'
          }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);
            switch (message.type) {
              case 'DOCUMENTATION_UPDATED':
                setDocumentation(message.payload);
                setError(null);
                break;
              case 'AVAILABLE_TOOLS':
                setAvailableTools(message.commands || message.payload);
                setError(null);
                // Forward the tools to the extension
                vscode.postMessage({
                  type: 'AVAILABLE_TOOLS',
                  commands: message.commands || message.payload
                });
                break;
              case 'ERROR':
                setError(message.payload);
                break;
            }
          } catch (err) {
            console.error('Failed to parse server message:', err);
            setError('Failed to parse server message');
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
          setIsConnected(false);
          vscode.postMessage({
            type: 'WEBSOCKET_STATUS',
            status: 'error',
            error: error.toString()
          });
          vscode.postMessage({ type: 'error', value: 'Failed to connect to MCP server' });
        };

        socket.onclose = () => {
          console.log('WebSocket connection closed');
          setWs(null);
          setIsConnected(false);
          setError('Connection closed');
          vscode.postMessage({
            type: 'WEBSOCKET_STATUS',
            status: 'closed'
          });
        };

        return () => {
          socket.close();
        };
      }
    };

    window.addEventListener('message', messageHandler);
    return () => {
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  const handleToolSelect = (tool: ToolSelection) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'SELECT_TOOL',
        payload: tool
      }));
    }
  };

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
            <>
              Connected to MCP server
              {availableTools.length > 0 && ` (${availableTools.length} tools available)`}
              {JSON.stringify(availableTools, null, 2)}
            </>
          ) : "Disconnected"}
        </div>
      </header>

      <div className="space-y-6">
        <section className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Available Tools</h2>
          <ToolSelector 
            onSelect={handleToolSelect} 
            isConnected={isConnected} 
            vscode={vscode} 
          />
        </section>

        {error ? (
          <section className="p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
            {error}
          </section>
        ) : documentation?.success && documentation.data ? (
          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                {documentation.data.name}
              </h2>
              {documentation.data.version && (
                <span className="text-sm text-gray-500">v{documentation.data.version}</span>
              )}
            </div>
            <pre className="p-4 bg-gray-50 dark:bg-gray-800 rounded overflow-auto font-mono text-sm text-gray-900 dark:text-gray-100">
              {documentation.data.helpText}
            </pre>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Last updated: {new Date(documentation.data.lastUpdated).toLocaleString()}
            </p>
          </section>
        ) : null}
      </div>
    </div>
  );
} 