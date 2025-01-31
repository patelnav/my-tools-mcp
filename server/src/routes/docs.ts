import { Router } from 'express';
import { DocumentationResponse, ToolSelection } from '@my-tools-mcp/shared';
import { spawn } from 'child_process';

const router = Router();

router.post('/fetch', async (req, res) => {
  const { name, projectPath }: ToolSelection = req.body;

  try {
    const helpText = await new Promise<string>((resolve, reject) => {
      const child = spawn(name, ['-h'], {
        cwd: projectPath,
        shell: true
      });

      let output = '';
      let error = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        error += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(error || `Process exited with code ${code}`));
        } else {
          resolve(output);
        }
      });
    });

    const response: DocumentationResponse = {
      success: true,
      data: {
        name,
        version: '1.0.0', // TODO: Add version detection
        helpText,
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(response);
  } catch (error) {
    const response: DocumentationResponse = {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    res.status(500).json(response);
  }
});

export default router; 