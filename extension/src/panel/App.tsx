import React, { useEffect, useState } from 'react';
import { DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';
import { cn } from '../utils/cn';

declare const acquireVsCodeApi: () => {
  postMessage: (message: any) => void;
};

const vscode = acquireVsCodeApi();

export function App() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [documentation, setDocumentation] = useState<DocumentationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');

    socket.onopen = () => {
      console.log('Connected to MCP server');
      setWs(socket);
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
      vscode.postMessage({ type: 'error', value: 'Failed to connect to MCP server' });
    };

    socket.onclose = () => {
      setWs(null);
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
    <div className="p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">MCP Tools Documentation</h1>
      </header>

      <main>
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
            <pre className="p-4 bg-gray-100 rounded overflow-auto">
              {documentation.data.helpText}
            </pre>
            <p className="text-sm text-gray-500">
              Last updated: {new Date(documentation.data.lastUpdated).toLocaleString()}
            </p>
          </div>
        ) : (
          <p className="text-gray-500">Select a tool to view its documentation</p>
        )}
      </main>
    </div>
  );
} 