/** @jsx h */
import { h } from 'preact';

interface LoadingStateProps {
  error?: string;
}

export function LoadingState({ error }: LoadingStateProps) {
  return (
    <div className="flex items-center justify-center min-h-[200px] text-lg">
      {error ? (
        <div className="text-red-500 dark:text-red-400 p-5 text-center">
          <h1 className="text-xl font-semibold mb-2">Error Loading MCP Tools</h1>
          <pre className="text-sm bg-red-50 dark:bg-red-900/30 p-2 rounded">{error}</pre>
        </div>
      ) : (
        <div className="text-gray-600 dark:text-gray-300">
          Loading MCP Tools...
        </div>
      )}
    </div>
  );
} 