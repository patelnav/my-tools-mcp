# Test Organization

## Quick Reference

### Test Types & Locations
```
src/__tests__/
├── vitest/              # Integration tests (ESM)
│   ├── docs/           # Documentation tests
│   └── setup.ts        # Vitest setup
└── vscode/             # VS Code tests (CommonJS)
    ├── runTest.cts     # VS Code test runner
    └── suite/          # VS Code test suite
        ├── index.cts   # Test suite entry point
        └── *.test.cts  # Test files
```

### Running Tests
```bash
pnpm test:vitest        # Run integration tests
pnpm test:vscode        # Run VS Code tests
pnpm test:all          # Run all tests
```

## Module System Strategy

The project uses a mixed module system approach:

1. **Main Project (ESM)**
   - Root `package.json`: `"type": "module"`
   - Modern ES modules for better tree-shaking
   - Used by Vitest tests and React components

2. **VS Code Extension (CommonJS)**
   - VS Code API requires CommonJS
   - Extension code built with webpack (CommonJS output)
   - Test files use `.cts` extension
   - Single `package.json` in VS Code test directory

## Test Environment Setup

### Vitest Tests
- Uses ESM (`.ts` files)
- Configuration in `vitest.config.ts`:
  ```typescript
  export default defineConfig({
    test: {
      testTimeout: 2000,    // 2s for tests
      hookTimeout: 2000,    // 2s for hooks
      teardownTimeout: 200, // 200ms for cleanup
      setupFiles: ['src/__tests__/vitest/setup.ts'],
      environment: 'node'
    }
  });
  ```
- Test setup in `setup.ts`:
  - Starts MCP server
  - Sets up test workspace
  - Handles cleanup
- No webpack involvement
- Native ESM support

### VS Code Tests
- Uses CommonJS (`.cts` files)
- Dedicated `package.json` with `"type": "commonjs"`
- Configuration in `src/__tests__/vscode/tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "module": "commonjs",
      "outDir": "../../../out/vscode-tests",
      "types": ["mocha", "node"]
    }
  }
  ```
- Test runner in `runTest.cts`:
  - Uses `@vscode/test-electron`
  - Handles extension loading
  - Sets up test workspace
- Direct TypeScript compilation
- Fixed test port (54321)

## Common Patterns

### WebSocket Testing
```typescript
// Setup connection
const ws = await createTestWebSocket(url, {
  origin: 'vscode-test://mcp-tools',
  timeout: TIMEOUTS.STANDARD
});

// Wait for response
const message = await waitForWsMessage(
  ws, 
  WS_MESSAGE_TYPES.RESPONSE_TYPE,
  TIMEOUTS.STANDARD
);

// Cleanup
ws.close();
```

### VS Code Testing
```typescript
// Get extension
const ext = vscode.extensions.getExtension('id');
await ext.activate();

// Test WebView
const panel = ext.exports.getWebviewPanel();
await panel.webview.postMessage({ type: 'TEST' });

// Wait for response
await new Promise<void>((resolve) => {
  panel.webview.onDidReceiveMessage(msg => {
    if (msg.type === 'RESPONSE') resolve();
  });
});
```

## Best Practices

### Module Imports
- VS Code tests: Use relative paths (../../utils/logging)
- Vitest tests: Can use path aliases
- Keep imports consistent within each test suite
- No path aliases in VS Code tests (makes debugging easier)

### Test Organization
- Keep tests close to implementation
- Use appropriate module system per domain
- Share utilities within module boundaries
- Maintain clear separation of concerns

### Test Cleanup
1. **Server Cleanup**
   - Close WebSocket connections first
   - Wait for WebSocket server to close
   - Close HTTP server
   - Clear test instances

2. **Resource Management**
   - Dispose WebView panels
   - Clean test workspaces
   - Reset global state

### Test Logging
```typescript
// Enable test logging
setLogCallback((msg, type) => {
  console.log(`[${new Date().toISOString()}] ${msg}`);
});

// Log test steps
logStep('Test step description');
logSuccess('Test succeeded');
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - VS Code tests use fixed port 54321
   - Other tests use random ports 54321-54421
   - Solution: Check `lsof -i :54321` and kill processes

2. **WebSocket Errors**
   - Verify origin matches test environment
   - Check connection cleanup
   - Use test utilities for connections

## Test Timeouts

All timeouts must follow these rules:

1. **Valid Values**
   - Must be powers of 10 multiplied by 2: [2, 20, 200, 2000, 20000] ms
   - No timeout may exceed 20 seconds (20000ms)
   - Default timeouts:
     - Test timeout: 2000ms (2s)
     - Hook timeout: 2000ms (2s)
     - Teardown timeout: 200ms
     - Connection timeout: 200ms
     - Cleanup wait: 20ms

2. **Configuration Locations**
   - Vitest: Global timeouts in `vitest.config.ts`
   - VS Code: Per-test timeouts in test files
   - Server operations: Constants in `src/constants.ts`

3. **Best Practices**
   - Use smallest sufficient timeout value
   - Document timeout choices in comments
   - Use constants from `TIMEOUTS` object
   - Prefer event-based waiting over fixed timeouts