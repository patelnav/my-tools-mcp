import React, { useEffect, useState } from 'react';
import { DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';
import { cn } from '../utils/cn';
import { ToolSelector } from './components/ToolSelector';

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

export function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
      console.log('Connected to MCP server');
      setWs(socket);
      setIsConnected(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        switch (message.type) {
          case 'DOCUMENTATION_UPDATED':
            setDocumentation(message.payload);
            setError(null);
            break;
          case 'ERROR':
            setError(message.payload);
            break;
        }
      } catch (err) {
        setError('Failed to parse server message');
      }
    };

    socket.onerror = () => {
      setError('WebSocket connection error');
      setIsConnected(false);
      vscode.postMessage({ type: 'error', value: 'Failed to connect to MCP server' });
    };

    socket.onclose = () => {
      setWs(null);
      setIsConnected(false);
      setError('Connection closed');
    };

    return () => {
      socket.close();
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
        <h1 className="text-2xl font-bold">MCP Tools Documentation</h1>
        <div className={cn(
          "mt-2 px-3 py-1 rounded text-sm",
          isConnected 
            ? "bg-green-100 text-green-700" 
            : "bg-red-100 text-red-700"
        )}>
          {isConnected ? "Connected to MCP server" : "Disconnected"}
        </div>
      </header>

      <div className="space-y-6">
        <section className="bg-gray-50 p-4 rounded-lg">
          <h2 className="text-lg font-semibold mb-4">Select Tool</h2>
          <ToolSelector onSelect={handleToolSelect} isConnected={isConnected} />
        </section>

        <section>
          {error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded">
              {error}
            </div>
          ) : documentation?.success && documentation.data ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{documentation.data.name}</h2>
                <span className="text-sm text-gray-500">v{documentation.data.version}</span>
              </div>
              <pre className="p-4 bg-gray-50 rounded overflow-auto font-mono text-sm">
                {documentation.data.helpText}
              </pre>
              <p className="text-sm text-gray-500">
                Last updated: {new Date(documentation.data.lastUpdated).toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">Select a tool to view its documentation</p>
          )}
        </section>
      </div>
    </div>
  );
} 