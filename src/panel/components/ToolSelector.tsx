import React, { useState, useEffect } from 'react';
import { ToolSelection } from '@/types/types';
import { cn } from '@/utils/cn';

interface ToolSelectorProps {
  onSelect: (tool: ToolSelection) => void;
  isConnected: boolean;
  vscode: {
    postMessage: (message: any) => void;
    getState: () => any;
  };
}

export function ToolSelector({ onSelect, isConnected, vscode }: ToolSelectorProps) {
  const [toolName, setToolName] = useState('');
  const [projectPath, setProjectPath] = useState('');

  useEffect(() => {
    console.log('Requesting workspace path...');
    // Request workspace path from extension
    vscode.postMessage({ type: 'GET_WORKSPACE_PATH' });

    // Listen for workspace path response
    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      console.log('Received message:', message);
      if (message.type === 'WORKSPACE_PATH') {
        console.log('Setting project path to:', message.path);
        setProjectPath(message.path);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName) return;

    console.log('Submitting with:', { toolName, projectPath });
    onSelect({
      name: toolName,
      projectPath: projectPath || window.location.pathname // Fallback to current path if not set
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="toolName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Tool Name
        </label>
        <input
          type="text"
          id="toolName"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          className={cn(
            "w-full px-3 py-2 border rounded-md",
            "bg-white dark:bg-gray-800",
            "text-gray-900 dark:text-gray-100",
            "border-gray-300 dark:border-gray-700",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "placeholder-gray-500 dark:placeholder-gray-400"
          )}
          placeholder="Enter tool name (e.g. git, npm)"
          disabled={!isConnected}
          required
        />
        {projectPath && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Using workspace: {projectPath}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isConnected || !toolName}
        className={cn(
          "w-full px-4 py-2 text-white rounded-md",
          "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:ring-offset-2 dark:focus:ring-offset-gray-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-200"
        )}
      >
        Fetch Documentation
      </button>
    </form>
  );
} 