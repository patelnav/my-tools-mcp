# MCP-Connected Command Tool Documentation Server

A VSCode/Cursor extension that automatically retrieves and displays command-line tool documentation based on your project folder and selected tools.

## Project Structure

```
mcp-doc-server/
├── extension/           # VSCode/Cursor extension
├── server/             # Node.js backend server
├── ui/                 # React frontend
└── shared/             # Shared types and utilities
```

## Development Setup

1. Install dependencies:
```bash
pnpm install
```

2. Start development server:
```bash
# Start the backend server
pnpm --filter server dev

# Start the UI development server
pnpm --filter ui dev

# Build the extension
pnpm --filter extension build
```

## Features

- 🔍 Automatically detects installed CLI tools
- 📚 Fetches and displays up-to-date documentation
- 🔄 Real-time updates when tool versions change
- 🎯 Validates commands against installed versions

## License

ISC 