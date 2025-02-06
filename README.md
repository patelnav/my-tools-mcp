# MCP Tools Documentation

A VSCode/Cursor extension that provides an integrated MCP server and UI panel for retrieving and displaying command-line tool documentation. The extension automatically detects tools in your workspace and provides their documentation through a WebView panel.

## Core Features

- 🔄 **Built-in MCP Server**
  - Express + WebSocket server (ports 54321-54421)
  - Secure origin validation
  - Automatic port selection
  - Connection management and cleanup

- 🔍 **Tool Discovery**
  - Package scripts (npm, yarn, pnpm)
  - Local binaries (node_modules/.bin)
  - Global tools (git, npm, yarn, pnpm)
  - Monorepo workspace support

- 📚 **Documentation Retrieval**
  - Help command execution (-h, --help)
  - Version information fetching
  - Secure command validation
  - Error handling

- 💻 **VS Code Integration**
  - React-based WebView panel
  - Status bar integration
  - Command palette support
  - Workspace path detection

## Architecture

### 1. VS Code Extension (Backend)
```
Extension Host (src/extension.ts)
├── Activates when VS Code starts
├── Creates MCP Server
│   └── Express + WebSocket Server (54321-54421 port range)
└── Creates WebView Panel
```

### 2. MCP Server (Middle Layer)
```
MCP Server (src/server/*)
├── WebSocket Server
│   ├── Handles 'GET_AVAILABLE_TOOLS' messages
│   └── Handles 'SELECT_TOOL' messages
│
└── Tool Discovery System
    ├── path-scanner.ts
    │   └── Finds tools in workspace (bin/, node_modules/.bin)
    └── package-scanner.ts
        └── Scans package.json for available tools
```

### 3. WebView Panel (Frontend)
```
React WebView (src/panel/*)
├── UI Components
│   └── Shows available tools and their docs
│
└── WebSocket Client
    ├── Requests available tools
    └── Requests tool documentation
```

## Project Structure

```
my-tools-mcp/
├── src/                      # Source code
│   ├── extension.ts          # Extension entry point
│   ├── env.ts               # Environment configuration
│   ├── server/              # Built-in MCP server
│   │   ├── index.ts         # Server setup and WebSocket handling
│   │   └── controllers/     # Tool discovery and execution
│   │       ├── docs/        # Documentation controllers
│   │       ├── path-scanner.ts    # Tool discovery
│   │       └── package-scanner.ts # Package.json scanning
│   ├── panel/              # WebView UI (React)
│   │   ├── index.tsx      # WebView entry point
│   │   ├── App.tsx        # Main React component
│   │   └── components/    # UI components
│   ├── types/             # Shared TypeScript types
│   └── lib/               # Shared utilities
├── dist/                  # Compiled output
└── src/__tests__/        # Test files
```

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start development:
```bash
# Start webpack in watch mode
pnpm run dev

# Or build for production
pnpm run build
```

3. Launch the extension:
- Press F5 in VSCode to start debugging
- The extension will start both the MCP server and WebView panel

## Usage

1. Open the command palette (Cmd/Ctrl + Shift + P)
2. Type "MCP Tools" and select the command
3. The WebView panel will open and display available tools
4. Select a tool to view its documentation

## Technical Details

### Tool Discovery
- **Package Scripts**
  - Automatically detects npm/yarn/pnpm scripts
  - Shows script source and working directory
  - Supports monorepo workspaces
  - Validates script existence

- **Binary Tools**
  - Finds tools in node_modules/.bin
  - Detects global tools (git, npm, yarn, pnpm)
  - Validates tool existence and permissions
  - Handles path resolution

### Documentation Retrieval
- Executes help commands (-h, --help)
- Fetches version information
- Handles command execution errors
- Validates tool names and arguments
- Implements proper timeouts

### WebSocket Communication
- Real-time tool discovery updates
- Secure origin validation
- Connection management and cleanup
- Error handling and reporting
- Automatic reconnection support

### Security Features
- Tool name validation
- Command injection prevention
- Origin validation for WebSocket connections
- Proper error handling and reporting
- Resource cleanup

## Testing

The extension includes comprehensive tests:
- Integration tests for server functionality
- VS Code extension tests
- Tool discovery tests
- Security validation tests
- WebSocket communication tests

## License

ISC 