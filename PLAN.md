# **MCP-Connected Command Tool Documentation Server – Implementation Guide**

This single markdown file outlines the implemented approach for building a VSCode/Cursor extension that automatically retrieves and displays command-line tool documentation based on the user's project folder and selected tools. The UI is in React, and the build process uses Webpack for a robust, production-ready workflow.

---

## **1. Architecture Overview**

| **Component**            | **Role**                                                                                                                                                   | **Tech Notes**                                                 |
|--------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------|
| **VSCode/Cursor Extension** | Hosts both the MCP server and WebView panel, providing an all-in-one solution for tool documentation.                    | Built using TypeScript, React, and WebSocket communication. |
| **Built-in MCP Server**  | Integrated Express/WebSocket server that handles tool command execution and documentation caching.                  | Express + WebSocket server running on port 8080              |
| **React WebView Panel**   | Renders tool selection and documentation in a responsive interface within VSCode/Cursor.                        | Uses Tailwind CSS for styling; bundled with Webpack |
| **Communication**        | WebSocket-based communication between the panel and MCP server for real-time updates.                                                                                                     | Uses ws package for WebSocket implementation    |

---

## **2. Project Structure**

| **Directory**                                    | **Purpose**                                                                                                                                |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| **src/**                     | Root source directory containing all TypeScript/React code                                              |
| **src/extension.ts**                         | Main extension entry point that activates the MCP server and WebView panel                                                                                       |
| **src/server/**          | MCP server implementation with Express and WebSocket handling |
| **src/server/controllers/**                   | Controllers for handling tool documentation and version fetching            |
| **src/panel/**      | React-based WebView panel implementation                                                    |
| **src/panel/components/**           | Reusable React components for the WebView UI                                                         |
| **src/types/**           | Shared TypeScript types and interfaces                                                         |
| **src/utils/**           | Utility functions for both server and panel                                                         |

---

## **3. Implementation Details**

| **Feature**        | **Description**                                                                                                                                                                                                     | **Implementation**                                                                                                                                                            |
|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| **MCP Server**  | 1. Express server with WebSocket support <br>2. Tool documentation fetching and caching <br>3. Version detection for tools             | - Uses `ws` package for WebSocket server <br> - Implements in-memory caching for documentation <br> - Executes tool commands with `child_process.spawn`                                               |
| **WebView Panel**     | 1. React-based UI panel <br>2. Tool selection and documentation display <br>3. Real-time updates via WebSocket                                               | - Uses Tailwind CSS for styling <br> - Implements responsive layout <br> - Handles connection state and errors                                        |
| **Tool Documentation**   | 1. Fetches help text using `-h` flag <br>2. Gets version info using `--version` <br>3. Caches results for performance            | - Parses command output for version and help text <br> - Stores in memory cache with tool+path key <br> - Updates in real-time when tool changes                |
| **Project Integration** | 1. Detects workspace path automatically <br>2. Supports multiple tool documentation <br>3. Handles tool not found scenarios                           | - Uses VSCode workspace API <br> - Supports any CLI tool with `-h` and `--version` flags <br> - Provides error handling for missing tools                                   |

---

## **4. Technical Implementation**

| **Aspect**               | **Details**                                                                                                                             |
|--------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| **Build System**         | Webpack configuration for both extension and WebView, with path aliases for clean imports                                              |
| **Type Safety**          | Comprehensive TypeScript types shared between server and client                                                                        |
| **State Management**     | React hooks for local state, WebSocket for server communication                                                                        |
| **Error Handling**       | Graceful error handling for tool execution, WebSocket disconnects, and invalid commands                                                |
| **Performance**          | In-memory caching of tool documentation with automatic updates                                                                         |
| **UI/UX**               | Clean, modern interface with Tailwind CSS and proper error states                                                                      |

---

## **5. Testing Strategy**

| **Test Type**                                                      | **Coverage** |
|--------------------------------------------------------------------|-----------|
| Integration tests for WebSocket communication                      | ✓         |
| Tool documentation fetching and parsing                            | ✓         |
| Error handling and edge cases                                      | ✓         |
| UI component rendering and interaction                             | ✓         |
| Extension activation and panel creation                            | ✓         |

---

**The extension is now implemented as a self-contained solution that provides both the MCP server and documentation UI within VSCode/Cursor!**