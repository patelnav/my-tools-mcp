import { TestEnvironment, getTestEnvironment } from '@utils/workspace';
import { getTestMonorepoPath, validateTestWorkspacePath } from '@test/shared/workspace';

/**
 * Gets the workspace path for Vitest tests
 */
export function getWorkspacePath(): string {
    const env = getTestEnvironment();
    if (env === TestEnvironment.VITEST) {
        return getTestMonorepoPath();
    }
    return process.cwd();
}

/**
 * Creates a test workspace for Vitest tests
 */
export function createTestWorkspace(): string {
    const workspacePath = getWorkspacePath();
    return validateTestWorkspacePath(workspacePath, TestEnvironment.VITEST);
} 