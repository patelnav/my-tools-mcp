# MCP Tools Documentation

A VSCode/Cursor extension that provides an integrated MCP server and UI panel for retrieving and displaying command-line tool documentation. The extension automatically detects your workspace and provides real-time documentation updates for your selected tools.

## Features

- 🔄 Built-in MCP server with WebSocket support
- 🎯 Real-time documentation updates
- 📚 Automatic version detection
- 💾 Smart documentation caching
- 🎨 Modern UI with Tailwind CSS
- ⚡ Fast and responsive WebView panel

## Project Structure

```
my-tools-mcp/
├── src/                      # Source code
│   ├── extension.ts          # Extension entry point
│   ├── server/              # Built-in MCP server
│   │   ├── index.ts        # Server setup
│   │   └── controllers/    # Documentation controllers
│   ├── panel/              # WebView UI
│   │   ├── App.tsx        # Main React component
│   │   └── components/    # UI components
│   ├── types/              # Shared TypeScript types
│   └── utils/              # Utility functions
├── dist/                    # Compiled output
└── tests/                   # Test files
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

- **Integrated MCP Server**
  - Built-in Express server with WebSocket support
  - Runs on port 8080
  - Automatic tool version detection
  - Smart documentation caching

- **Modern UI**
  - Clean, responsive design with Tailwind CSS
  - Real-time connection status
  - Error handling and feedback
  - Documentation syntax highlighting

- **Tool Integration**
  - Automatic workspace detection
  - Support for any CLI tool with `-h` and `--version` flags
  - Real-time updates when tool versions change
  - Graceful handling of missing tools

## License

ISC 