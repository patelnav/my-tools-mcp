// @ts-check
const path = require('path');
const fs = require('fs');

/**
 * Gets the test monorepo path for VS Code tests
 * @returns {string}
 */
function getTestMonorepoPath() {
    const testMonorepoPath = path.resolve(__dirname, '../fixtures/test-monorepo');
    if (!fs.existsSync(testMonorepoPath)) {
        throw new Error(`Test monorepo not found at ${testMonorepoPath}`);
    }
    return testMonorepoPath;
}

/**
 * Validates and returns the test workspace path
 * @param {string} workspacePath
 * @returns {string}
 */
function validateTestWorkspacePath(workspacePath) {
    if (!fs.existsSync(workspacePath)) {
        throw new Error(`Test workspace not found at ${workspacePath}`);
    }
    return workspacePath;
}

/**
 * Sets up the test workspace for VS Code tests
 * @returns {string}
 */
function setupTestWorkspace() {
    const testMonorepoPath = getTestMonorepoPath();
    validateTestWorkspacePath(testMonorepoPath);
    return testMonorepoPath;
}

module.exports = {
    getTestMonorepoPath,
    validateTestWorkspacePath,
    setupTestWorkspace
}; 