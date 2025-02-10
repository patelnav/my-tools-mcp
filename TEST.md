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

### SSE Testing
```typescript
// Setup connection
const eventSource = new EventSource(`${serverUrl}/sse`);

// Handle connection open
eventSource.onopen = () => {
  console.log('SSE connection established');
};

// Handle messages
eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // Handle message
};

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Cleanup
eventSource.close();
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
   - Close SSE connections first
   - Wait for server to close
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

## SSE Connection Management

### Connection States
1. **Initial Connection**
   - Timeout: 200ms
   - Retry attempts: 3
   - Backoff: 20ms

2. **Message Exchange**
   - Timeout: 2000ms per message
   - Keep-alive interval: 20s
   - Ping/pong mechanism

3. **Reconnection**
   - Max retries: 3
   - Backoff: Exponential (20ms, 200ms, 2000ms)
   - State preservation

4. **Cleanup**
   - Grace period: 200ms
   - Force close: After 2000ms
   - Resource cleanup timeout: 20ms

### Error Handling
1. **Connection Errors**
   - Network issues
   - Invalid origin
   - Server unavailable

2. **Message Errors**
   - Invalid format
   - Missing fields
   - Protocol violations

3. **State Errors**
   - Connection lost
   - Server timeout
   - Client timeout

### Testing Patterns
1. **Connection Testing**
   ```typescript
   it('should handle connection lifecycle', async () => {
     // Setup
     const eventSource = new EventSource(url);
     
     // Test phases
     await testConnection(eventSource);
     await testMessageExchange(eventSource);
     await testReconnection(eventSource);
     
     // Cleanup
     await gracefulClose(eventSource);
   });
   ```

2. **Error Testing**
   ```typescript
   it('should handle errors gracefully', async () => {
     const eventSource = new EventSource(url);
     
     // Test error scenarios
     await testNetworkError(eventSource);
     await testInvalidMessage(eventSource);
     await testTimeout(eventSource);
     
     // Verify cleanup
     await verifyCleanup(eventSource);
   });
   ```

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

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   - VS Code tests use fixed port 54321
   - Other tests use random ports 54321-54421
   - Solution: Check `lsof -i :54321` and kill processes

2. **SSE Connection Issues**
   - Verify origin matches test environment
   - Check connection cleanup
   - Use test utilities for connections
   - Verify server state management

3. **State Management**
   - Monitor connection states
   - Track message sequences
   - Verify cleanup completion
   - Check resource disposal