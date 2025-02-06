import { useEffect, useState } from 'preact/hooks';
import type { 
  Command,
  WebSocketMessage,
  VSCodeMessage,
  DocumentationResponse
} from '@/types/types';

interface WebSocketState {
  ws: WebSocket | null;
  isConnected: boolean;
  error: string | null;
  availableTools: Command[];
  documentation: DocumentationResponse | null;
}

interface UseWebSocketProps {
  serverPort?: number;
  workspacePath: string;
  vscode: {
    postMessage: (message: VSCodeMessage) => void;
  };
}

export function useWebSocket({ serverPort, workspacePath, vscode }: UseWebSocketProps): WebSocketState {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<Command[]>([]);
  const [documentation, setDocumentation] = useState<DocumentationResponse | null>(null);

  useEffect(() => {
    if (!serverPort || !workspacePath) return;

    const wsUrl = `ws://localhost:${serverPort}?origin=vscode-test://mcp-tools`;
    console.log(`[WebSocket] Connecting to ${wsUrl}`);
    
    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => {
      console.log('[WebSocket] Connected');
      setWs(socket);
      setIsConnected(true);
      setError(null);
      
      vscode.postMessage({ type: 'WEBSOCKET_STATUS', status: 'connected' });
      
      // Request available tools
      socket.send(JSON.stringify({
        type: 'DISCOVER_TOOLS',
        payload: { projectPath: workspacePath }
      }));
    });

    socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        console.log('[WebSocket] Received:', message);

        switch (message.type) {
          case 'TOOLS_DISCOVERED':
            if (Array.isArray(message.payload)) {
              setAvailableTools(message.payload as Command[]);
              vscode.postMessage({ 
                type: 'TOOLS_DISCOVERED', 
                payload: message.payload as Command[] 
              });
            }
            break;
          case 'DOCUMENTATION_UPDATED':
            if (message.payload && typeof message.payload === 'object') {
              setDocumentation(message.payload as DocumentationResponse);
            }
            break;
          case 'ERROR':
            if (typeof message.payload === 'string') {
              console.error('[WebSocket] Server error:', message.payload);
              setError(message.payload);
            }
            break;
        }
      } catch (err) {
        console.error('[WebSocket] Failed to parse message:', err);
        setError('Failed to parse server message');
      }
    });

    socket.addEventListener('error', (error) => {
      console.error('[WebSocket] Error:', error);
      setError('WebSocket connection error');
      setIsConnected(false);
      vscode.postMessage({
        type: 'WEBSOCKET_STATUS',
        status: 'error',
        error: error.toString()
      });
    });

    socket.addEventListener('close', (event) => {
      console.log('[WebSocket] Closed:', event);
      setWs(null);
      setIsConnected(false);
      setError(`Connection closed: ${event.reason || 'Unknown reason'}`);
      vscode.postMessage({
        type: 'WEBSOCKET_STATUS',
        status: 'closed',
        error: event.reason || 'Unknown reason'
      });
    });

    return () => {
      console.log('[WebSocket] Cleaning up connection');
      socket.close();
    };
  }, [serverPort, workspacePath, vscode]);

  return {
    ws,
    isConnected,
    error,
    availableTools,
    documentation
  };
} 