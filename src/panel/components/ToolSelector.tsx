/** @jsx h */
import { h } from 'preact';
import { cn } from '@/utils/cn';
import type { ToolInfo } from '@/types/index';

interface ToolSelectorProps {
  onSelect: (toolName: string) => void;
  isConnected: boolean;
  tools: ToolInfo[];
  projectPath: string;
}

export function ToolSelector({ onSelect, isConnected, tools, projectPath }: ToolSelectorProps) {
  if (!isConnected) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        Waiting for connection...
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <div className="text-gray-500 dark:text-gray-400">
        No tools found in workspace: {projectPath}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 tool-selector">
      {tools.map((tool) => (
        <button
          key={tool.name}
          onClick={() => onSelect(tool.name)}
          className={cn(
            "p-4 rounded-lg text-left transition-colors",
            "bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600",
            "border border-gray-200 dark:border-gray-600",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          )}
        >
          <div className="font-medium text-gray-900 dark:text-gray-100">
            {tool.name}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {tool.type}
          </div>
        </button>
      ))}
    </div>
  );
} 