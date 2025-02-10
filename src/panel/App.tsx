/** @jsx h */
/** @jsxFrag Fragment */
import { h, Fragment } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { VSCodeMessage } from '@/types/index';
import { cn } from '@/utils/cn';
import './index.css';

interface AppProps {
  vscode: {
    postMessage: (message: VSCodeMessage) => void;
  };
}

interface MessageHistoryItem {
  timestamp: string;
  type: string;
  content: string;
}

// Message type styling configuration
const messageTypeStyles = {
  'WEBVIEW_READY': 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  'WEBVIEW_READY_CONFIRMED': 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  'WORKSPACE_PATH': 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  'MCP_STATUS': 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  'ERROR': 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  'GET_WORKSPACE_PATH': 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  'LOG': 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
  'default': 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
};

export function App({ vscode }: AppProps) {
  const [serverPort, setServerPort] = useState<number>();
  const [isWebViewReady, setIsWebViewReady] = useState(false);
  const [serverStatus, setServerStatus] = useState<'starting' | 'connected' | 'error'>('starting');
  const [messageHistory, setMessageHistory] = useState<MessageHistoryItem[]>([]);

  const serverUrl = serverPort ? `http://localhost:${serverPort}/sse` : undefined;
  
  // Initialize WebView
  useEffect(() => {
    vscode.postMessage({ type: 'WEBVIEW_READY' });
  }, [vscode]);

  // Request workspace path after WebView is ready
  useEffect(() => {
    if (!isWebViewReady) return;
    vscode.postMessage({ type: 'GET_WORKSPACE_PATH' });
  }, [isWebViewReady, vscode]);

  // Handle VS Code messages
  useEffect(() => {
    const handleMessage = (event: MessageEvent<VSCodeMessage>) => {
      const message = event.data;
      console.log('WebView received message:', message);
      
      // Add message to history
      setMessageHistory(prev => {
        // For LOG messages, format them nicely
        if (message.type === 'LOG') {
          const { timestamp, level, message: logMessage } = message.payload;
          return [...prev, {
            timestamp: new Date(timestamp).toLocaleTimeString(),
            type: 'LOG',
            content: `[${level.toUpperCase()}] ${logMessage}`
          }];
        }
        
        // For other messages, use existing format
        return [...prev, {
          timestamp: new Date().toLocaleTimeString(),
          type: message.type,
          content: JSON.stringify(message)
        }];
      });
      
      switch (message.type) {
        case 'WEBVIEW_READY_CONFIRMED':
          if (!isWebViewReady) {
            setIsWebViewReady(true);
          }
          break;
        case 'WORKSPACE_PATH':
          setServerPort(message.serverPort);
          break;
        case 'MCP_STATUS':
          setServerStatus(message.status === 'connected' ? 'connected' : 'error');
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, isWebViewReady]);

  const handleStartServer = () => {
    vscode.postMessage({ type: 'START_SERVER' });
  };

  const handleStopServer = () => {
    vscode.postMessage({ type: 'STOP_SERVER' });
  };

  const handleCopyUrl = () => {
    if (serverUrl) {
      navigator.clipboard.writeText(serverUrl);
      vscode.postMessage({ 
        type: 'SHOW_INFO', 
        message: 'Server URL copied to clipboard' 
      });
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP Tools</h1>
        
        {/* Server Status and Controls */}
        <div className="mt-4 space-y-2">
          <div className={cn(
            "px-3 py-2 rounded-lg",
            "border border-gray-200 dark:border-gray-700",
            "bg-white dark:bg-gray-800"
          )}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  serverStatus === 'connected' 
                    ? "bg-green-500" 
                    : serverStatus === 'error'
                    ? "bg-red-500"
                    : "bg-yellow-500"
                )}/>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {serverStatus === 'connected' ? 'Server Running' : serverStatus === 'error' ? 'Server Error' : 'Server Starting'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleStartServer}
                  disabled={serverStatus === 'connected'}
                  className={cn(
                    "px-3 py-1 text-sm rounded-md",
                    "transition-colors duration-200",
                    serverStatus === 'connected'
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                      : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300 dark:hover:bg-green-900/50"
                  )}
                >
                  Start
                </button>
                <button
                  onClick={handleStopServer}
                  disabled={serverStatus !== 'connected'}
                  className={cn(
                    "px-3 py-1 text-sm rounded-md",
                    "transition-colors duration-200",
                    serverStatus !== 'connected'
                      ? "bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 cursor-not-allowed"
                      : "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50"
                  )}
                >
                  Stop
                </button>
              </div>
            </div>

            {serverUrl && (
              <div className="mt-2 flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={serverUrl}
                  className={cn(
                    "flex-1 px-2 py-1 text-sm rounded",
                    "bg-gray-50 dark:bg-gray-900",
                    "text-gray-600 dark:text-gray-300",
                    "border border-gray-200 dark:border-gray-600",
                    "focus:outline-none focus:ring-2 focus:ring-blue-500"
                  )}
                />
                <button
                  onClick={handleCopyUrl}
                  className={cn(
                    "px-3 py-1 text-sm rounded-md",
                    "bg-blue-100 text-blue-700 hover:bg-blue-200",
                    "dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50",
                    "transition-colors duration-200"
                  )}
                >
                  Copy
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mt-6">
        <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Message History</h2>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 max-h-[600px] overflow-y-auto">
          {messageHistory.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">No messages yet</div>
          ) : (
            messageHistory.map((msg, index) => (
              <div key={index} className="mb-2 last:mb-0">
                <div className="flex items-start space-x-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{msg.timestamp}</span>
                  <span className={cn(
                    "px-2 py-0.5 text-xs rounded-full",
                    messageTypeStyles[msg.type as keyof typeof messageTypeStyles] || messageTypeStyles.default
                  )}>
                    {msg.type}
                  </span>
                </div>
                <pre className={cn(
                  "mt-1 text-sm font-mono p-2 rounded overflow-x-auto",
                  msg.type === 'LOG' 
                    ? "bg-transparent" 
                    : "bg-white dark:bg-gray-900"
                )}>
                  {msg.content}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}