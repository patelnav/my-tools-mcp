/** @jsx h */
import { h, render } from 'preact';
import { App } from './App';
import './index.css';
import type { VSCodeMessage } from '@/types/types';

declare const acquireVsCodeApi: () => {
  postMessage: (message: VSCodeMessage) => void;
  getState: () => any;
};

console.log('Panel index.tsx starting...');

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Create root container for React
const container = document.getElementById('root');
if (!container) {
  console.error('Root element not found!');
  vscode.postMessage({ type: 'ERROR', payload: 'Root element not found' });
  throw new Error('Root element not found');
}

console.log('Found root container, mounting Preact app...');

try {
  // Render the app
  render(<App vscode={vscode} />, container);
  console.log('Preact app mounted successfully');
} catch (error) {
  console.error('Failed to mount Preact app:', error);
  // Show error in the UI
  container.innerHTML = `
    <div style="color: red; padding: 20px;">
      <h1>Error Loading MCP Tools</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>
  `;
  // Send error to extension
  vscode.postMessage({ 
    type: 'ERROR', 
    payload: error instanceof Error ? error.message : String(error)
  });
} 