/**
 * Centralized constants for the MCP Tools Documentation Server
 */

// WebSocket Message Types
export const WS_MESSAGE_TYPES = {
  DISCOVER_TOOLS: 'DISCOVER_TOOLS',
  TOOLS_DISCOVERED: 'TOOLS_DISCOVERED',
  SELECT_TOOL: 'SELECT_TOOL',
  DOCUMENTATION_UPDATED: 'DOCUMENTATION_UPDATED',
  ERROR: 'ERROR',
  WORKSPACE_PATH: 'WORKSPACE_PATH',
  WEBSOCKET_STATUS: 'WEBSOCKET_STATUS'
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  // Server Errors
  INVALID_MESSAGE_FORMAT: 'Invalid message format',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded',
  INVALID_ORIGIN: 'Invalid origin',
  SERVER_ERROR: 'Internal server error',
  INVALID_PROJECT_PATH: 'Project path is invalid or inaccessible',
  INVALID_SERVER_ADDRESS: 'Invalid server address',
  SERVER_START_TIMEOUT: 'Server failed to start within timeout',
  SERVER_HEALTH_CHECK_FAILED: 'Server health check failed',
  
  // Tool Errors
  TOOL_NOT_FOUND: (name: string) => `Tool "${name}" not found`,
  TOOL_NOT_EXECUTABLE: (name: string) => `Tool "${name}" is not executable`,
  INVALID_TOOL_NAME: (name: string) => `Invalid tool name: ${name}`,
  DOCUMENTATION_FETCH_FAILED: 'Failed to fetch tool documentation',
  TOOL_DISCOVERY_FAILED: 'Failed to discover available tools',
  
  // Path Errors
  WORKSPACE_PATH_REQUIRED: 'Workspace path is required',
  NO_WORKSPACE_FOLDER: 'No workspace folder found',
  
  // Package Manager Errors
  INVALID_PACKAGE_MANAGER: (pm: string) => `Unsupported package manager: "${pm}". Use npm, pnpm, or yarn.`,
  INVALID_PACKAGE_COMMAND: (pm: string) => `Invalid package manager command. Use format: "${pm} run <script>" or "${pm} exec <command>"`,
  MISSING_SCRIPT_NAME: (pm: string, cmd: string) => `Missing script/command name. Use format: "${pm} ${cmd} <name>"`
} as const;

// Tool Types
export const TOOL_TYPES = {
  NPM_SCRIPT: 'npm-script',
  PACKAGE_BIN: 'package-bin',
  WORKSPACE_BIN: 'workspace-bin',
  GLOBAL_BIN: 'global-bin'
} as const;

// WebSocket Status
export const WS_STATUS = {
  CONNECTED: 'connected',
  ERROR: 'error',
  CLOSED: 'closed'
} as const;

// Documentation Status
export const DOC_STATUS = {
  VERSION_UNKNOWN: 'Version unknown',
  HELP_NOT_AVAILABLE: 'Help text not available',
  SCRIPT_HELP_NOT_AVAILABLE: 'Help text not available for npm scripts. This is a custom script defined in package.json.'
} as const;

// Timeouts (in milliseconds)
export const TIMEOUTS = {
  STANDARD: 2000,        // 2s for standard operations
  RATE_LIMIT: 100,       // 100ms for rate limiting
  DOC_FETCH: 5000,       // 5s for documentation fetching (may need network)
  SERVER_START: 2000,    // 2s for server startup
  CONNECTION: 2000,      // 2s for connection attempts
  COMMAND_EXECUTION: 5000 // 5s for command execution (may need process spawn)
} as const;

// Security
export const SECURITY = {
  MAX_OUTPUT_SIZE: 50000,
  RATE_LIMIT_WINDOW_MS: 60000,
  MAX_REQUESTS_PER_MINUTE: 60
} as const; 