# MCP Tools Documentation

A VSCode/Cursor extension that provides an integrated MCP server and UI panel for retrieving and displaying command-line tool documentation. The extension automatically detects your workspace and provides real-time documentation updates for your selected tools.

## Features

- 🔄 Built-in MCP server with WebSocket support
- 🎯 Real-time documentation updates
- 📚 Automatic version detection
- 💾 Smart documentation caching
- 🎨 Modern UI with Tailwind CSS
- ⚡ Fast and responsive WebView panel

## Architecture

### 1. VS Code Extension (Backend)
```
Extension Host (src/extension.ts)
├── Activates when VS Code starts
├── Creates MCP Server
│   └── Express + WebSocket Server
└── Creates WebView Panel
```

### 2. MCP Server (Middle Layer)
```
MCP Server (src/server/*)
├── WebSocket Server
│   ├── Handles 'GET_AVAILABLE_TOOLS' messages
│   └── Handles 'SELECT_TOOL' messages
│
├── Tool Discovery System
│   ├── path-scanner.ts
│   │   └── Finds tools in workspace (bin/, node_modules/.bin, scripts)
│   └── package-scanner.ts
│       └── Scans package.json for available tools
│
└── Tool Execution System
    └── command-executor.ts
        └── Executes tools with proper working directory
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

### 4. Communication Flow
```
User opens extension
│
Extension activates
├── Starts MCP Server
│   └── Opens WebSocket on available port
│
└── Creates WebView Panel
    │
    WebView connects to WebSocket
    │
    ├── Sends 'GET_AVAILABLE_TOOLS'
    │   │
    │   MCP Server
    │   ├── Uses path-scanner to find tools
    │   └── Returns tool list to WebView
    │
    └── User selects tool
        │
        WebView sends 'SELECT_TOOL'
        │
        MCP Server
        ├── Uses command-executor to get tool docs
        └── Returns documentation to WebView
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
│   │       ├── package-scanner.ts # Package.json scanning
│   │       └── command-executor.ts # Secure command execution
│   ├── panel/              # WebView UI (React)
│   │   ├── index.tsx      # WebView entry point
│   │   ├── App.tsx        # Main React component
│   │   └── components/    # UI components
│   ├── types/             # Shared TypeScript types
│   └── lib/               # Shared utilities
├── dist/                  # Compiled output
└── tests/                # Test files
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
3. Enter a tool name (e.g., "git", "npm")
4. View the tool's documentation and version information

## Features in Detail

- **Tool Discovery**
  - Automatic workspace scanning
  - Package.json script detection
  - Binary tool detection
  - Working directory awareness

- **Documentation Retrieval**
  - Secure command execution
  - Version detection
  - Help text parsing
  - Smart caching

- **Modern UI**
  - Clean, responsive design with Tailwind CSS
  - Real-time connection status
  - Error handling and feedback
  - Documentation syntax highlighting

## License

ISC 