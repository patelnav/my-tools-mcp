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

export type CommandType = 'script' | 'tool' | 'package-manager';

export interface Command {
  command: string;
  description: string;
  package?: string;
  type: CommandType;
  group?: string;
} 