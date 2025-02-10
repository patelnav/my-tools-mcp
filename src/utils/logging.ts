/**
 * Test logging utilities for formatted console output
 */

// Import vscode for both types and runtime
let vscode: typeof import('vscode') | undefined;
try {
  // Only import vscode in VSCode extension environment
  vscode = require('vscode');
} catch {
  // Not in VSCode environment
  vscode = undefined;
}

import type { MyToolsPanel } from '@/panel/MyToolsPanel';

export type LogLevel = 'info' | 'error' | 'warn' | 'debug';
export type LogComponent = 'MCP' | 'Protocol' | 'Tools' | 'Extension';

interface LogMessage {
  timestamp: string;
  level: LogLevel;
  component: LogComponent;
  message: string;
  data?: unknown;
}

let webviewPanel: MyToolsPanel | undefined;
let debugStatusBar: import('vscode').StatusBarItem | undefined;
let isDebugMode = false;
let isVSCodeEnabled = false;

export function initializeLogging(panel?: MyToolsPanel, statusBar?: import('vscode').StatusBarItem, debug = false, enableVSCode = true) {
  webviewPanel = panel;
  debugStatusBar = statusBar;
  isDebugMode = debug;
  isVSCodeEnabled = enableVSCode && vscode !== undefined;
}

function formatLogMessage(component: LogComponent, message: string, data?: unknown): string {
  const baseMessage = `[${component}] ${message}`;
  if (data) {
    try {
      return `${baseMessage}: ${JSON.stringify(data, null, 2)}`;
    } catch {
      return `${baseMessage}: [Unserializable Data]`;
    }
  }
  return baseMessage;
}

function updateDebugStatusBar(level: LogLevel) {
  if (!isVSCodeEnabled || !debugStatusBar || !vscode) return;

  switch (level) {
    case 'error':
      debugStatusBar.text = "$(error) MCP Debug: Error";
      debugStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
      break;
    case 'warn':
      debugStatusBar.text = "$(warning) MCP Debug: Warning";
      debugStatusBar.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
      break;
    default:
      debugStatusBar.text = "$(bug) MCP Debug: Active";
      debugStatusBar.backgroundColor = undefined;
  }
}

function sendToWebview(logMsg: LogMessage) {
  if (!isVSCodeEnabled || !webviewPanel) return;

  webviewPanel._panel.webview.postMessage({
    type: 'LOG',
    payload: logMsg
  });
}

export function log(
  component: LogComponent,
  message: string,
  level: LogLevel = 'info',
  data?: unknown
) {
  const timestamp = new Date().toISOString();
  const formattedMessage = formatLogMessage(component, message, data);
  const logMsg: LogMessage = { timestamp, level, component, message: formattedMessage };

  // Console logging
  switch (level) {
    case 'error':
      console.error(`[${timestamp}] ${formattedMessage}`);
      break;
    case 'warn':
      console.warn(`[${timestamp}] ${formattedMessage}`);
      break;
    case 'debug':
      if (isDebugMode) {
        console.debug(`[${timestamp}] ${formattedMessage}`);
      }
      break;
    default:
      console.log(`[${timestamp}] ${formattedMessage}`);
  }

  // VSCode-specific logging
  if (isVSCodeEnabled) {
    // WebView logging
    sendToWebview(logMsg);

    // Debug status bar
    if (isDebugMode && debugStatusBar) {
      updateDebugStatusBar(level);
    }
  }
}

// Convenience methods
export const logInfo = (component: LogComponent, message: string, data?: unknown) => 
  log(component, message, 'info', data);

export const logError = (component: LogComponent, message: string, data?: unknown) => 
  log(component, message, 'error', data);

export const logWarn = (component: LogComponent, message: string, data?: unknown) => 
  log(component, message, 'warn', data);

export const logDebug = (component: LogComponent, message: string, data?: unknown) => 
  log(component, message, 'debug', data);

// Protocol-specific logging
export const logProtocol = (message: string, data?: unknown) => 
  log('Protocol', message, 'info', data);

// Tools-specific logging
export const logTools = (message: string, data?: unknown) => 
  log('Tools', message, 'info', data); 