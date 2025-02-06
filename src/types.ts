export interface Tool {
  name: string;
  location?: string;
  workingDirectory: string;
  type: 'npm-script' | 'package-bin' | 'workspace-bin' | 'global-bin';
  context: Record<string, any>;
} 