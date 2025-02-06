const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
    try {
        const extensionDevelopmentPath = process.cwd();
        const extensionTestsPath = path.resolve(__dirname, 'suite/index.cjs');
        const testWorkspace = path.resolve(__dirname, '../fixtures/test-monorepo');

        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [testWorkspace]
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exit(1);
    }
}

main(); 