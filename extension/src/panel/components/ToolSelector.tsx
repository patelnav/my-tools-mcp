import React, { useState } from 'react';
import { ToolSelection } from '@my-tools-mcp/shared';
import { cn } from '../../utils/cn';

interface ToolSelectorProps {
  onSelect: (tool: ToolSelection) => void;
  isConnected: boolean;
}

export function ToolSelector({ onSelect, isConnected }: ToolSelectorProps) {
  const [toolName, setToolName] = useState('');
  const [projectPath, setProjectPath] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!toolName || !projectPath) return;

    onSelect({
      name: toolName,
      projectPath
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="toolName" className="block text-sm font-medium mb-1">
          Tool Name
        </label>
        <input
          type="text"
          id="toolName"
          value={toolName}
          onChange={(e) => setToolName(e.target.value)}
          className={cn(
            "w-full px-3 py-2 border rounded-md",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          placeholder="Enter tool name (e.g. git, npm)"
          disabled={!isConnected}
          required
        />
      </div>

      <div>
        <label htmlFor="projectPath" className="block text-sm font-medium mb-1">
          Project Path
        </label>
        <input
          type="text"
          id="projectPath"
          value={projectPath}
          onChange={(e) => setProjectPath(e.target.value)}
          className={cn(
            "w-full px-3 py-2 border rounded-md",
            "focus:outline-none focus:ring-2 focus:ring-blue-500",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
          placeholder="Enter project path"
          disabled={!isConnected}
          required
        />
      </div>

      <button
        type="submit"
        disabled={!isConnected || !toolName || !projectPath}
        className={cn(
          "w-full px-4 py-2 text-white bg-blue-500 rounded-md",
          "hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "transition-colors duration-200"
        )}
      >
        Fetch Documentation
      </button>
    </form>
  );
} 