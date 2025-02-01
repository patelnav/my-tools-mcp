/**
 * Logger module for tool documentation
 * 
 * Provides consistent logging functionality with test mode awareness.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private isTestMode(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  private log(level: LogLevel, message: string, ...args: any[]): void {
    if (this.isTestMode()) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    switch (level) {
      case 'error':
        console.error(prefix, message, ...args);
        break;
      case 'warn':
        console.warn(prefix, message, ...args);
        break;
      case 'debug':
      case 'info':
      default:
        console.log(prefix, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.log('error', message, ...args);
  }
}

export const logger = new Logger(); 