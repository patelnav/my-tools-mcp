import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // Use the test-monorepo fixture as our workspace
        const workspaceDir = path.resolve(__dirname, '../__tests__/fixtures/test-monorepo');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                workspaceDir, // Open our test-monorepo workspace
                '--disable-extensions' // Disable other extensions to avoid interference
            ]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main(); 