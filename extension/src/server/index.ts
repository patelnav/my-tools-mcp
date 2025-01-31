import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ServerConfig, DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';
import { fetchToolDocumentation } from './controllers/docs';

const config: ServerConfig = {
  port: 8080,
  host: 'localhost'
};

export function startMCPServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Create HTTP server
  const server = createServer(app);

  // Create WebSocket server
  const wss = new WebSocketServer({ server });

  // WebSocket connection handling
  wss.on('connection', (ws) => {
    console.log('Client connected to MCP server');

    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('Received:', data);

        if (data.type === 'SELECT_TOOL') {
          const toolSelection: ToolSelection = data.payload;
          try {
            const documentation = await fetchToolDocumentation(toolSelection);
            ws.send(JSON.stringify({
              type: 'DOCUMENTATION_UPDATED',
              payload: documentation
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'ERROR',
              payload: error instanceof Error ? error.message : 'Failed to fetch documentation'
            }));
          }
        }
      } catch (error) {
        console.error('Error handling message:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          payload: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('Client disconnected from MCP server');
    });
  });

  // Start the server
  server.listen(config.port, config.host, () => {
    console.log(`MCP server running at http://${config.host}:${config.port}`);
  });

  return server;
} 