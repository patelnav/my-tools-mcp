/** @jsx h */
import { h } from 'preact';
import type { 
  ToolSelection, 
  ToolInfo
} from '@/types/types';
import { cn } from '@/utils/cn';

interface ToolSelectorProps {
  onSelect: (tool: ToolSelection) => void;
  isConnected: boolean;
  tools: ToolInfo[];
  projectPath: string;
}

export function ToolSelector({ onSelect, isConnected, tools, projectPath }: ToolSelectorProps) {
  const handleCommandSelect = (tool: ToolInfo) => {
    console.log('[ToolSelector] Tool clicked:', tool);
    if (!tool?.name || !projectPath) {
      console.error('[ToolSelector] Invalid tool selection:', { tool, projectPath });
      return;
    }
    const selection = {
      name: tool.name,
      projectPath: projectPath || window.location.pathname
    };
    console.log('[ToolSelector] Sending tool selection:', selection);
    onSelect(selection);
  };

  return (
    <div className="space-y-4">
      {projectPath && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Workspace: {projectPath}
        </p>
      )}

      <div>
        <h3 className="font-medium text-gray-700 dark:text-gray-300 mb-4">
          Available Tools ({tools.length})
        </h3>

        <div className="space-y-1">
          {tools.map((tool, index) => (
            <button
              key={`${tool.name}-${index}`}
              onClick={() => handleCommandSelect(tool)}
              className={cn(
                "w-full text-left p-3",
                "bg-white dark:bg-gray-800",
                "hover:bg-gray-50 dark:hover:bg-gray-700",
                "border border-gray-200 dark:border-gray-700",
                "rounded-md",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={!isConnected}
            >
              <div className="flex flex-col">
                <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
                  {tool.name}
                </span>
                {tool.type && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {tool.type}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 