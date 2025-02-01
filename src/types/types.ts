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
  data?: ToolDocumentation;
  error?: string;
} 