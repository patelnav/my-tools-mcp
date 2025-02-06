import WebSocket from 'ws';
import { getTestMonorepoPath } from '@test/shared/workspace';
import { getWorkspacePath } from '@test/vitest/workspace';
import { WS_MESSAGE_TYPES, TIMEOUTS } from '@/constants';

/**
 * Test environment utilities and constants
 */

// Test environment detection
export const isTestEnvironment = process.env.VSCODE_TEST === '1';

// Common paths
export const TEST_FIXTURES_PATH = getTestMonorepoPath();
export const TEST_MONOREPO_PATH = getTestMonorepoPath();

/**
 * Gets the test workspace path based on environment
 */
export { getWorkspacePath as getTestWorkspacePath };

/**
 * Common WebSocket test utilities
 */

export interface WsTestOptions {
  origin?: string;
  timeout?: number;
}

/**
 * Creates a WebSocket connection for testing with timeout
 */
export const createTestWebSocket = (url: string, options: WsTestOptions = {}): Promise<WebSocket> => {
  const { origin, timeout = TIMEOUTS.STANDARD } = options;

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { origin });
    const timeoutId = setTimeout(() => {
      ws.close();
      reject(new Error(`WebSocket connection timed out after ${timeout}ms`));
    }, timeout);

    ws.on('open', () => {
      clearTimeout(timeoutId);
      resolve(ws);
    });

    ws.on('error', (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });
  });
};

/**
 * Waits for a specific message type from WebSocket
 */
export const waitForWsMessage = <T = any>(
  ws: WebSocket,
  expectedType: string,
  timeout: number = TIMEOUTS.STANDARD
): Promise<{ type: string; payload: T }> => {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for message type "${expectedType}" after ${timeout}ms`));
    }, timeout);

    const messageHandler = (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === expectedType) {
          cleanup();
          resolve(message);
        } else if (message.type === WS_MESSAGE_TYPES.ERROR) {
          cleanup();
          reject(new Error(`Received error: ${message.payload}`));
        }
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const errorHandler = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      ws.removeListener('message', messageHandler);
      ws.removeListener('error', errorHandler);
    };

    ws.on('message', messageHandler);
    ws.on('error', errorHandler);
  });
};

/**
 * VS Code mock utilities
 */

export const createMockVsCodeApi = () => {
  return {
    ExtensionContext: class {
      subscriptions: any[] = [];
      extensionPath: string = '';
      storagePath: string = '';
      globalState = {
        get: () => undefined,
        update: () => Promise.resolve()
      };
      workspaceState = {
        get: () => undefined,
        update: () => Promise.resolve()
      };
    },

    window: {
      createWebviewPanel: () => ({
        webview: {
          html: '',
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          postMessage: () => Promise.resolve()
        },
        onDidDispose: () => ({ dispose: () => {} }),
        dispose: () => {}
      }),
      showErrorMessage: () => Promise.resolve(),
      showInformationMessage: () => Promise.resolve()
    },

    workspace: {
      getConfiguration: () => ({
        get: () => undefined,
        update: () => Promise.resolve()
      }),
      workspaceFolders: [{ uri: { fsPath: getTestMonorepoPath() } }]
    },

    commands: {
      registerCommand: () => ({ dispose: () => {} })
    },

    Uri: {
      file: (path: string) => ({ fsPath: path }),
      parse: (path: string) => ({ fsPath: path })
    },

    EventEmitter: class {
      event = () => ({ dispose: () => {} });
      fire() {}
      dispose() {}
    },

    ViewColumn: {
      One: 1,
      Two: 2,
      Three: 3
    },

    WebviewPanel: class {
      constructor() {
        this.webview = {
          html: '',
          onDidReceiveMessage: () => ({ dispose: () => {} }),
          postMessage: () => Promise.resolve()
        };
      }
      webview: any;
      onDidDispose = () => ({ dispose: () => {} });
      dispose = () => {};
    }
  };
}; 