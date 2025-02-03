# **MCP-Connected Command Tool Documentation Server – Implementation Guide**

This single markdown file outlines the implemented approach for building a VSCode/Cursor extension that automatically discovers and displays command-line tool documentation from the user's project. The UI is in React, and the build process uses Webpack for a robust, production-ready workflow.

---

## **1. Architecture Overview**

| **Component**            | **Role**                                                                                                                                                   | **Tech Notes**                                                 |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| **VSCode/Cursor Extension** | Hosts both the MCP server and WebView panel, providing an all-in-one solution for automatic tool discovery and documentation.                    | Built using TypeScript, React, and WebSocket communication. |
| **Built-in MCP Server**  | Integrated Express/WebSocket server that automatically discovers tools, handles command execution, and manages documentation caching.                  | Express + WebSocket server with automatic tool discovery              |
| **React WebView Panel**   | Displays discovered tools with their documentation and version information.                        | Uses Tailwind CSS for styling; bundled with Webpack |
| **Communication**        | WebSocket-based communication between the panel and MCP server for real-time tool discovery and documentation updates.                                                                                                     | Uses ws package for WebSocket implementation    |

---

## **2. Project Structure**

| **Directory**                                    | **Purpose**                                                                                                                                |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **src/**                     | Root source directory containing all TypeScript/React code                                              |
| **src/extension.ts**                         | Main extension entry point that activates the MCP server and WebView panel                                                                                       |
| **src/server/**          | MCP server implementation with automatic tool discovery and WebSocket handling |
| **src/server/controllers/**                   | Controllers for tool discovery, documentation fetching, and version detection            |
| **src/panel/**      | React-based WebView panel for tool documentation display                                                    |
| **src/panel/components/**           | Reusable React components for documentation viewing                                                         |
| **src/types/**           | Shared TypeScript types and interfaces                                                         |
| **src/lib/**           | Utility functions and shared code                                                         |

---

## **3. Tool Discovery System**

| **Feature**        | **Description**                                                                                                                                                                                                     | **Implementation**                                                                                                                                                            |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **Package Detection**  | 1. Detects package manager (npm/yarn/pnpm) <br>2. Scans package.json for scripts <br>3. Identifies executable tools             | - Checks for lock files to determine package manager <br> - Scans workspace and package.json files <br> - Probes tools for help and version flags                                               |
| **Tool Location**     | 1. Finds tools in node_modules/.bin <br>2. Finds tools in workspace bin/ <br>3. Finds package.json scripts                                               | - Scans specific directories <br> - Records tool locations and working directories <br> - Handles monorepo workspaces                                        |
| **Command Discovery**   | 1. Discovers available commands <br>2. Detects help and version flags <br>3. Finds subcommands when available            | - Tests multiple help/version flag patterns <br> - Extracts version information <br> - Caches command availability                |

---

## **4. UI Components**

| **Component**               | **Features**                                                                                                                             |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| **Tool List**         | List of discovered tools with their locations                                              |
| **Documentation Viewer**     | Displays tool documentation with version info and last updated timestamp                                                                        |
| **Connection Status**       | Shows WebSocket connection state and tool count                                                |
| **Error Display**               | Clear error messages for connection, tool, and documentation issues                                                                      |

---

## **5. Testing Strategy**

| **Test Type**                                                      | **Implementation** |
|--------------------------------------------------------------------|-----------|
| **Package Scanner Tests** | - Package.json scanning <br> - Available commands detection <br> - Script and tool discovery | 
| **Security Tests** | - Tool name validation <br> - Command argument validation <br> - Path traversal prevention |
| **Server Integration Tests** | - WebSocket communication <br> - Documentation fetching <br> - Error handling |

### Test Implementation Plan

1. **Package Scanner Suite**
```typescript
describe('Package Scanner', () => {
  describe('scanPackageJson', () => {
    it('should find all scripts across workspace packages')
    it('should find all executable dependencies')
  });

  describe('getAvailableCommands', () => {
    it('should list all available package scripts')
    it('should list available tool commands with help flags')
    it('should include package manager help commands')
    it('should include command metadata')
  });
});
```

2. **Security Suite**
```typescript
describe('Security Module', () => {
  describe('validateToolName', () => {
    it('should allow valid direct tool names')
    it('should allow valid package manager commands')
    it('should reject invalid package manager commands')
    it('should reject blacklisted tools')
    it('should reject tool names with shell expansions')
    it('should reject tool names with path traversal')
    it('should reject tool names with invalid characters')
  });

  describe('validateArgs', () => {
    it('should allow valid documentation arguments')
    it('should reject invalid arguments')
  });
});
```

3. **Server Integration Suite**
```typescript
describe('MCP Server Integration', () => {
  it('should connect to the WebSocket server')
  it('should fetch git documentation')
  it('should handle invalid tool gracefully')
  it('should handle invalid message format')
  it('should validate workspace path exists')
});
```

### Test Coverage Goals

| **Component**          | **Coverage Target** | **Priority Areas**                    |
|-----------------------|---------------------|--------------------------------------|
| Package Scanner       | 95%                 | Command discovery, Script detection |
| Security Layer       | 100%                | Tool validation, Argument checking  |
| Server Integration   | 90%                 | WebSocket handling, Error cases     |

---

**The extension provides automatic tool discovery and documentation, with a focus on reliability and security!**