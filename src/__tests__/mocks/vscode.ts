// Mock implementation of vscode module for testing
export const ExtensionContext = class {
  subscriptions: any[] = [];
  extensionPath: string = '';
  storagePath: string = '';
  globalState = {
    get: (key: string) => undefined,
    update: (key: string, value: any) => Promise.resolve()
  };
  workspaceState = {
    get: (key: string) => undefined,
    update: (key: string, value: any) => Promise.resolve()
  };
};

export const window = {
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
};

export const workspace = {
  getConfiguration: () => ({
    get: () => undefined,
    update: () => Promise.resolve()
  }),
  workspaceFolders: [{ uri: { fsPath: process.cwd() } }]
};

export const commands = {
  registerCommand: () => ({ dispose: () => {} })
};

export const Uri = {
  file: (path: string) => ({ fsPath: path }),
  parse: (path: string) => ({ fsPath: path })
};

export const EventEmitter = class {
  event = () => ({ dispose: () => {} });
  fire() {}
  dispose() {}
};

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3
}

export const WebviewPanel = class {
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
}; 