const path = require('path');
const Mocha = require('mocha');
const { glob } = require('glob');

/**
 * Runs the VS Code extension test suite
 * 
 * This is the main entry point for VS Code's test runner.
 * It sets up Mocha with the appropriate configuration and
 * discovers all test files in the suite directory.
 *
 * @returns {Promise<void>}
 */
async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 30000,
        retries: 2,
        reporter: 'spec',
        slow: 10000
    });

    const testsRoot = __dirname;
    const files = await glob('*.test.cjs', { cwd: testsRoot });

    files.sort();
    
    files.forEach((f: string) => {
        console.log(`Adding test file: ${f}`);
        mocha.addFile(path.resolve(testsRoot, f));
    });

    try {
        return new Promise<void>((resolve, reject) => {
            console.log('Starting VS Code test suite...');
            console.log(`Test environment: ${process.env.VSCODE_TEST === 'true' ? 'VS Code Test' : 'Unknown'}`);
            console.log(`Node environment: ${process.env.NODE_ENV}`);
            
            mocha.run((failures: number) => {
                if (failures > 0) {
                    console.error(`${failures} tests failed`);
                    reject(new Error(`${failures} tests failed`));
                } else {
                    console.log('All tests passed successfully');
                    resolve();
                }
            });
        });
    } catch (err) {
        console.error('Error running tests:', err);
        throw err;
    }
}

module.exports = { run }; 