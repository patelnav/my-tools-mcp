import { createMockVsCodeApi } from '../utils/test-utils';

// Export all mock VS Code APIs from the test utilities
export const {
  ExtensionContext,
  window,
  workspace,
  commands,
  Uri,
  EventEmitter,
  ViewColumn,
  WebviewPanel
} = createMockVsCodeApi();