import * as path from 'path';
import { TestEnvironment } from '@utils/workspace';

/**
 * Gets the path to the test monorepo fixture
 */
export function getTestMonorepoPath(): string {
    return path.resolve(__dirname, '../fixtures/test-monorepo');
}

/**
 * Validates a workspace path for test environments
 */
export function validateTestWorkspacePath(workspacePath: string, env: TestEnvironment): string {
    if (!workspacePath) {
        throw new Error('Workspace path is required');
    }
    
    // In test environments, ensure we're using the test monorepo
    if (env !== TestEnvironment.NONE) {
        const testPath = getTestMonorepoPath();
        if (path.resolve(workspacePath) !== path.resolve(testPath)) {
            throw new Error(`Invalid test workspace path. Expected ${testPath}`);
        }
    }
    
    return path.resolve(workspacePath);
} 