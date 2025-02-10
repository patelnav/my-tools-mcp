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

// VSCode Message Types
export type VSCodeMessageType = 
  | 'GET_WORKSPACE_PATH'
  | 'WORKSPACE_PATH'
  | 'ERROR'
  | 'HELLO'
  | 'HELLO_RESPONSE'
  | 'WEBVIEW_READY'
  | 'WEBVIEW_READY_CONFIRMED'
  | 'MCP_STATUS'
  | 'GET_STATE'
  | 'STATE_UPDATE'
  | 'START_SERVER'
  | 'STOP_SERVER'
  | 'SHOW_INFO'
  | 'LOG';

export interface BaseVSCodeMessage<T = unknown> {
  type: VSCodeMessageType;
  payload?: T;
}

export interface WorkspacePathMessage extends BaseVSCodeMessage {
  type: 'WORKSPACE_PATH';
  path: string;
  serverPort?: number;
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

export interface GetWorkspacePathMessage extends BaseVSCodeMessage {
  type: 'GET_WORKSPACE_PATH';
}

export interface WebViewReadyMessage extends BaseVSCodeMessage {
  type: 'WEBVIEW_READY';
}

export interface WebViewReadyConfirmedMessage extends BaseVSCodeMessage {
  type: 'WEBVIEW_READY_CONFIRMED';
}

export interface MCPStatusMessage extends BaseVSCodeMessage {
  type: 'MCP_STATUS';
  status: 'connected' | 'error' | 'disconnected';
  error?: string;
}

export interface StateUpdateMessage extends BaseVSCodeMessage {
  type: 'STATE_UPDATE';
  payload: {
    isConnected: boolean;
    tools: ToolInfo[];
  };
}

export interface GetStateMessage extends BaseVSCodeMessage {
  type: 'GET_STATE';
}

export interface StartServerMessage extends BaseVSCodeMessage {
  type: 'START_SERVER';
}

export interface StopServerMessage extends BaseVSCodeMessage {
  type: 'STOP_SERVER';
}

export interface ShowInfoMessage extends BaseVSCodeMessage {
  type: 'SHOW_INFO';
  message: string;
}

export interface LogMessage extends BaseVSCodeMessage {
  type: 'LOG';
  payload: {
    timestamp: string;
    level: 'info' | 'error' | 'warn';
    message: string;
  };
}

export type VSCodeMessage = 
  | WorkspacePathMessage
  | ErrorMessage
  | HelloMessage
  | HelloResponseMessage
  | GetWorkspacePathMessage
  | WebViewReadyMessage
  | WebViewReadyConfirmedMessage
  | MCPStatusMessage
  | StateUpdateMessage
  | GetStateMessage
  | StartServerMessage
  | StopServerMessage
  | ShowInfoMessage
  | LogMessage; 