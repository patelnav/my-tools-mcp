/**
 * Centralized environment configuration
 * This file manages all environment-related settings and state
 */

export type Environment = 'development' | 'test' | 'production';

class EnvironmentManager {
  private _isTestMode: boolean = false;
  private _environment: Environment;

  constructor() {
    // Initialize environment from NODE_ENV, defaulting to 'development'
    const nodeEnv = process.env.NODE_ENV?.toLowerCase() as Environment;
    this._environment = nodeEnv === 'test' || nodeEnv === 'production' 
      ? nodeEnv 
      : 'development';
  }

  /**
   * Get the current environment
   */
  get environment(): Environment {
    return this._environment;
  }

  /**
   * Check if we're in test mode
   */
  get isTestMode(): boolean {
    return this._isTestMode || this._environment === 'test';
  }

  /**
   * Set test mode explicitly (useful for tests that don't want to modify NODE_ENV)
   */
  setTestMode(isTest: boolean): void {
    this._isTestMode = isTest;
    if (isTest) {
      this._environment = 'test';
    }
  }

  /**
   * Check if we're in development mode
   */
  get isDevelopment(): boolean {
    return this._environment === 'development';
  }

  /**
   * Check if we're in production mode
   */
  get isProduction(): boolean {
    return this._environment === 'production';
  }

  /**
   * Should we log messages?
   */
  get shouldLog(): boolean {
    // Allow explicit override via environment variable
    if (process.env.SHOULD_LOG) {
      return process.env.SHOULD_LOG === 'true';
    }
    // Otherwise use default behavior
    return !this.isTestMode;
  }

  /**
   * Get executable extensions for the current platform
   */
  get executableExtensions(): string[] {
    return process.platform === 'win32'
      ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';')
      : [''];
  }
}

// Export a singleton instance
export const env = new EnvironmentManager();

// For convenience, export commonly used getters
export const isTestMode = () => env.isTestMode;
export const isDevelopment = () => env.isDevelopment;
export const isProduction = () => env.isProduction;
export const shouldLog = () => env.shouldLog; 