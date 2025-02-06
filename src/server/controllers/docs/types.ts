export interface CommandOptions {
  cwd?: string;
  currentDir?: string;
  timeout?: number;
  maxOutputSize?: number;
}

export interface CommandResult {
  output: string;
  code: number;
}

export interface CommandError extends Error {
  code?: string;
} 