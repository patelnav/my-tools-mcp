import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ServerConfig, DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';
import docsRouter from './routes/docs';
import { fetchToolDocumentation } from './controllers/docs';

const config: ServerConfig = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || 'localhost'
};

const app = express();
app.use(cors());
app.use(express.json());

// Mount routes
app.use('/api/docs', docsRouter);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// WebSocket connection handling
wss.on('connection', (ws) => {
  console.log('Client connected');

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
    console.log('Client disconnected');
  });
});

// Start the server
server.listen(config.port, () => {
  console.log(`Server running at http://${config.host}:${config.port}`);
}); 