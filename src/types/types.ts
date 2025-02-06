export interface ToolDocumentation {
  name: string;
  version: string;
  helpText: string;
  lastUpdated: string;
}

export interface ToolSelection {
  name: string;
  projectPath: string;
}

export interface ServerConfig {
  port: number;
  host: string;
}

export interface DocumentationResponse {
  success: boolean;
  data?: {
    name: string;
    version: string;
    helpText: string;
    lastUpdated: number;
  };
  error?: string;
}

export interface ToolInfo {
  name: string;
  type: 'script' | 'npm-script' | 'package-bin' | 'workspace-bin' | 'global-bin';
  location?: string;
  workingDirectory?: string;
  context?: Record<string, unknown>;
}

export type CommandType = 'script' | 'tool' | 'package-manager';

export interface Command {
  command: string;
  description: string;
  package?: string;
  type: CommandType;
  group?: string;
}

// WebSocket Message Types
export type WebSocketMessageType = 
  | 'DISCOVER_TOOLS'
  | 'TOOLS_DISCOVERED'
  | 'SELECT_TOOL'
  | 'DOCUMENTATION_UPDATED'
  | 'ERROR';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  payload: T;
}

// VSCode Message Types
export type VSCodeMessageType = 
  | 'GET_WORKSPACE_PATH'
  | 'WORKSPACE_PATH'
  | 'WEBSOCKET_STATUS'
  | 'TOOLS_DISCOVERED'
  | 'DISCOVER_TOOLS'
  | 'ERROR'
  | 'HELLO'
  | 'HELLO_RESPONSE'
  | 'DOCUMENTATION_UPDATED'
  | 'WEBVIEW_READY'
  | 'WEBVIEW_READY_CONFIRMED'
  | 'GET_SERVER_PORT';

export interface BaseVSCodeMessage<T = unknown> {
  type: VSCodeMessageType;
  payload?: T;
}

export interface WorkspacePathMessage extends BaseVSCodeMessage {
  type: 'WORKSPACE_PATH';
  path: string;
  serverPort?: number;
}

export interface WebSocketStatusMessage extends BaseVSCodeMessage {
  type: 'WEBSOCKET_STATUS';
  status: 'connected' | 'error' | 'closed';
  error?: string;
}

export interface ToolsDiscoveredMessage extends BaseVSCodeMessage {
  type: 'TOOLS_DISCOVERED';
  payload: ToolInfo[];
}

export interface DiscoverToolsMessage extends BaseVSCodeMessage {
  type: 'DISCOVER_TOOLS';
  payload: {
    projectPath: string;
  };
}

export interface ErrorMessage extends BaseVSCodeMessage {
  type: 'ERROR';
  payload: string;
}

export interface HelloMessage extends BaseVSCodeMessage {
  type: 'HELLO';
}

export interface HelloResponseMessage extends BaseVSCodeMessage {
  type: 'HELLO_RESPONSE';
  text: string;
}

export interface DocumentationUpdatedMessage extends BaseVSCodeMessage {
  type: 'DOCUMENTATION_UPDATED';
  payload: DocumentationResponse;
}

export interface GetWorkspacePathMessage extends BaseVSCodeMessage {
  type: 'GET_WORKSPACE_PATH';
}

export interface WebViewReadyMessage extends BaseVSCodeMessage {
  type: 'WEBVIEW_READY';
}

export interface WebViewReadyConfirmedMessage extends BaseVSCodeMessage {
  type: 'WEBVIEW_READY_CONFIRMED';
}

export interface GetServerPortMessage extends BaseVSCodeMessage {
  type: 'GET_SERVER_PORT';
}

export type VSCodeMessage = 
  | WorkspacePathMessage
  | WebSocketStatusMessage
  | ToolsDiscoveredMessage
  | DiscoverToolsMessage
  | ErrorMessage
  | HelloMessage
  | HelloResponseMessage
  | DocumentationUpdatedMessage
  | GetWorkspacePathMessage
  | WebViewReadyMessage
  | WebViewReadyConfirmedMessage
  | GetServerPortMessage; 