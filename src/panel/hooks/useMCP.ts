import { useEffect, useState } from 'preact/hooks';
import type { VSCodeMessage, ToolInfo } from '@/types/index';
import { MCPClient } from '../client';

interface UseMCPProps {
  serverPort?: number;
  workspacePath: string;
  vscode: {
    postMessage: (message: VSCodeMessage) => void;
  };
}

interface MCPState {
  isConnected: boolean;
  error: string | null;
  availableTools: ToolInfo[];
  documentation: any | null;
  fetchDocumentation: (toolName: string) => Promise<void>;
}

export function useMCP({ serverPort, workspacePath, vscode }: UseMCPProps): MCPState {
  const [client, setClient] = useState<MCPClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTools, setAvailableTools] = useState<ToolInfo[]>([]);
  const [documentation, setDocumentation] = useState<any | null>(null);

  // Initialize MCP client and discover tools when server info is available
  useEffect(() => {
    if (!serverPort || !workspacePath) return;

    const mcpClient = new MCPClient(vscode);
    setClient(mcpClient);

    // Connect and discover tools
    (async () => {
      try {
        // Connect to server - tools are already cached during extension activation
        await mcpClient.connect(serverPort);
        
        // List tools
        const tools = await mcpClient.listTools(workspacePath);
        const toolInfos = tools.map(name => ({
          name,
          type: 'global-bin' as const,
          workingDirectory: workspacePath
        }));
        
        setAvailableTools(toolInfos);
        setIsConnected(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setIsConnected(false);
      }
    })();

    return () => {
      mcpClient.disconnect().catch(console.error);
    };
  }, [serverPort, workspacePath, vscode]);

  // Function to fetch tool documentation
  const fetchDocumentation = async (toolName: string) => {
    if (!client || !isConnected) return;
    try {
      const info = await client.getToolInfo(toolName, workspacePath);
      setDocumentation(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return {
    isConnected,
    error,
    availableTools,
    documentation,
    fetchDocumentation
  };
} 