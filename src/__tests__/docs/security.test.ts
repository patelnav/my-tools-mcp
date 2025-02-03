import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { validateToolName, validateArgs, BLACKLISTED_TOOLS } from '@server/controllers/docs/security';
import { join } from 'path';
import { isPackageCommandAvailable } from '../../server/controllers/docs/package-scanner';

// Mock the isBinaryAvailable function
vi.mock('@server/controllers/docs/path-scanner', () => ({
  isBinaryAvailable: async (binaryName: string) => {
    const validBinaries = new Set(['git', 'node', 'drizzle-kit', 'vite', 'vitest']);
    return validBinaries.has(binaryName);
  }
}));

const MOCK_PROJECT_PATH = join(__dirname, '../fixtures/test-monorepo');
const MOCK_BIN_PATH = join(MOCK_PROJECT_PATH, 'bin');

describe('Security Module', () => {
  beforeEach(async () => {
    // Add a small delay between tests to avoid port conflicts
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('validateToolName', () => {
    it('should allow valid direct tool names', async () => {
      process.env.PATH = MOCK_BIN_PATH;
      expect(await validateToolName('git', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('node', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('vite', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('vitest', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('drizzle-kit', MOCK_PROJECT_PATH)).toBe(true);
    });

    it('should allow valid package manager commands', async () => {
      const validCommands = [
        'pnpm run build',
        'pnpm run test',
        'pnpm exec vite',
        'npm run start',
        'npm test',
        'yarn run build',
        'yarn exec vite',
        'pnpm start',
        'npm start'
      ];

      for (const command of validCommands) {
        expect(await validateToolName(command, MOCK_PROJECT_PATH)).toBe(true);
      }
    });

    it('should reject invalid package manager commands', async () => {
      const invalidCommands = [
        'pnpm', // missing subcommand
        'npm run', // missing script name
        'yarn exec', // missing command
        'pnpm invalid-subcommand test',
        'npm do-something',
        'yarn unknown-command'
      ];

      for (const command of invalidCommands) {
        expect(await validateToolName(command, MOCK_PROJECT_PATH)).toBe(false);
      }
    });

    it('should reject blacklisted tools', async () => {
      for (const tool of BLACKLISTED_TOOLS) {
        expect(await validateToolName(tool, MOCK_PROJECT_PATH)).toBe(false);
      }
    });

    it('should reject tool names with shell expansions', async () => {
      const invalidNames = [
        'git $(echo hack)',
        'npm ${PATH}',
        'pnpm `ls`',
        'node; rm -rf /',
        'git && echo hack',
        'npm || true'
      ];

      for (const name of invalidNames) {
        expect(await validateToolName(name, MOCK_PROJECT_PATH)).toBe(false);
      }
    });

    it('should reject tool names with path traversal', async () => {
      const invalidNames = [
        '../git',
        'npm/../hack',
        '/usr/bin/git',
        'C:\\Windows\\System32\\cmd'
      ];

      for (const name of invalidNames) {
        expect(await validateToolName(name, MOCK_PROJECT_PATH)).toBe(false);
      }
    });

    it('should reject tool names with invalid characters', async () => {
      const invalidNames = [
        'git!', 'npm#', 'pnpm$', 'node%', 'git^', 'npm&', 'pnpm*',
        'node(', 'git)', 'npm=', 'pnpm+', 'node{', 'git}', 'npm[',
        'pnpm]', 'node\\', 'git\'', 'npm"', 'pnpm<', 'node>', 'git?',
        'npm,', 'pnpm:', 'node;'
      ];

      for (const name of invalidNames) {
        expect(await validateToolName(name, MOCK_PROJECT_PATH)).toBe(false);
      }
    });
  });

  describe('validateArgs', () => {
    it('should allow valid documentation arguments', () => {
      const validArgSets = [
        ['--help'],
        ['-h'],
        ['--version'],
        ['-v']
      ];

      validArgSets.forEach(args => {
        expect(validateArgs(args)).toBe(true);
      });
    });

    it('should reject invalid arguments', () => {
      const invalidArgSets = [
        ['--invalid'],
        ['-x'],
        ['--help', '--invalid'],
        ['--version', '-x'],
        ['--rm'],
        ['-rf'],
        ['--delete'],
        ['--exec']
      ];

      invalidArgSets.forEach(args => {
        expect(validateArgs(args)).toBe(false);
      });
    });
  });

  describe('isPackageCommandAvailable', () => {
    it('should allow valid package manager commands', async () => {
      expect(await isPackageCommandAvailable('npm run test:ui', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run test:coverage', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:help', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:generate:help', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:push:help', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:studio:help', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:check:help', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:generate', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:push', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:studio', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm run db:check', MOCK_PROJECT_PATH)).toBe(true);
    });

    it('should reject invalid package manager commands', async () => {
      const invalidCommands = [
        'pnpm', // missing subcommand
        'npm run', // missing script name
        'yarn exec', // missing command
        'pnpm invalid-subcommand test',
        'npm do-something',
        'yarn unknown-command'
      ];

      for (const command of invalidCommands) {
        expect(await isPackageCommandAvailable(command, MOCK_PROJECT_PATH)).toBe(false);
      }
    });
  });
}); 