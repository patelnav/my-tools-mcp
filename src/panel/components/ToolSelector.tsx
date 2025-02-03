import React from 'react';
import { useState, useEffect } from 'preact/hooks';
import { ToolSelection, Command } from '@/types/types';
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
  const [projectPath, setProjectPath] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);

  useEffect(() => {
    console.log('Requesting workspace path and tools...');
    vscode.postMessage({ type: 'GET_WORKSPACE_PATH' });
    vscode.postMessage({ type: 'GET_AVAILABLE_TOOLS' });

    const messageHandler = (event: { data: any }) => {
      const message = event.data;
      console.log('Received message type:', message.type);
      console.log('Full message data:', message);
      
      if (message.type === 'WORKSPACE_PATH') {
        console.log('Setting workspace path:', message.path);
        setProjectPath(message.path);
      } else if (message.type === 'AVAILABLE_TOOLS') {
        console.log('Available tools payload:', message.payload);
        console.log('Available tools commands:', message.commands);
        const toolsList = message.commands || message.payload || [];
        console.log('Setting commands:', toolsList);
        setCommands(toolsList);
      }
    };

    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [vscode]);

  const handleCommandSelect = (command: Command) => {
    onSelect({
      name: command.command,
      projectPath: projectPath || window.location.pathname
    });
  };

  return (
    <div className="space-y-4">
      {projectPath && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Workspace: {projectPath}
        </p>
      )}

      <div className="space-y-2">
        <h3 className="font-medium text-gray-700 dark:text-gray-300">
          All Tools ({commands.length})
        </h3>
        <div className="space-y-1">
          {commands.map((command, index) => (
            <button
              key={`${command.command}-${index}`}
              onClick={() => handleCommandSelect(command)}
              className={cn(
                "w-full text-left px-3 py-2 rounded",
                "hover:bg-gray-100 dark:hover:bg-gray-700",
                "focus:outline-none focus:ring-2 focus:ring-blue-500",
                "disabled:opacity-50",
                "transition-colors duration-150"
              )}
              disabled={!isConnected}
            >
              <div className="font-mono text-sm text-gray-900 dark:text-gray-100">
                {command.command}
              </div>
              {command.description && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {command.description}
                </div>
              )}
              {command.package && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {command.package}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
} 