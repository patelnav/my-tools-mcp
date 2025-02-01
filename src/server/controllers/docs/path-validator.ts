/**
 * Path validation module for tool documentation
 * 
 * Handles validation of project paths and directory access checks.
 */

import path from 'path';
import { access, stat } from 'fs/promises';
import { constants } from 'fs';
import { logger } from './logger';

/**
 * Validates a project path for security and accessibility
 * @param projectPath The path to validate
 * @returns Promise<boolean> indicating if the path is valid and accessible
 */
export async function validateProjectPath(projectPath: string): Promise<boolean> {
  try {
    // Resolve to absolute path
    const absolutePath = path.resolve(projectPath);
    logger.debug(`Validating project path: ${absolutePath}`);
    
    // Check if path exists and is a directory
    const stats = await stat(absolutePath);
    if (!stats.isDirectory()) {
      logger.warn(`Project path is not a directory: ${absolutePath}`);
      return false;
    }
    
    // Check if we have read access
    await access(absolutePath, constants.R_OK);
    
    return true;
  } catch (error) {
    logger.warn(`Error validating project path: ${error}`);
    return false;
  }
}

/**
 * Confirms that a directory exists and is accessible
 * @param projectPath The path to check
 * @returns Promise<boolean> indicating if the directory exists and is accessible
 */
export async function confirmDirectoryExists(projectPath: string): Promise<boolean> {
  try {
    const stats = await stat(projectPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
} 