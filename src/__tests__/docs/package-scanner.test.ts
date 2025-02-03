import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { scanWorkspaceTools, getToolInfo, type ToolInfo } from '../../server/controllers/docs/path-scanner';

const MONOREPO_ROOT = join(__dirname, '../fixtures/test-monorepo');
const MOCK_BIN_PATH = join(MONOREPO_ROOT, 'bin');

describe('Package Scanner', () => {
  const originalPath = process.env.PATH;

  beforeAll(() => {
    // Add mock binaries to PATH
    process.env.PATH = `${MOCK_BIN_PATH}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`;
  });

  afterAll(() => {
    // Restore original PATH
    process.env.PATH = originalPath;
  });

  describe('scanWorkspaceTools', () => {
    let tools: Map<string, ToolInfo>;

    beforeAll(async () => {
      tools = await scanWorkspaceTools(MONOREPO_ROOT);
    });

    it('should find npm scripts with correct metadata', async () => {
      const testScript = tools.get('npm:test');
      expect(testScript).toBeDefined();
      expect(testScript).toEqual({
        name: 'npm:test',
        location: expect.stringContaining('package.json'),
        workingDirectory: MONOREPO_ROOT,
        type: 'npm-script',
        context: {
          scriptSource: expect.stringContaining('package.json')
        }
      });

      const buildScript = tools.get('npm:build');
      expect(buildScript).toBeDefined();
      expect(buildScript).toEqual({
        name: 'npm:build',
        location: expect.stringContaining('package.json'),
        workingDirectory: MONOREPO_ROOT,
        type: 'npm-script',
        context: {
          scriptSource: expect.stringContaining('package.json')
        }
      });
    });

    it('should find package binaries with correct metadata', async () => {
      const drizzleKit = tools.get('drizzle-kit');
      expect(drizzleKit).toBeDefined();
      expect(drizzleKit).toEqual({
        name: 'drizzle-kit',
        location: expect.stringContaining('node_modules/.bin/drizzle-kit'),
        workingDirectory: MONOREPO_ROOT,
        type: 'package-bin',
        context: {}
      });

      const vitest = tools.get('vitest');
      expect(vitest).toBeDefined();
      expect(vitest).toEqual({
        name: 'vitest',
        location: expect.stringContaining('node_modules/.bin/vitest'),
        workingDirectory: MONOREPO_ROOT,
        type: 'package-bin',
        context: {}
      });
    });

    it('should find workspace binaries with correct metadata', async () => {
      const git = tools.get('git');
      expect(git).toBeDefined();
      expect(git).toEqual({
        name: 'git',
        location: expect.stringContaining('bin/git'),
        workingDirectory: MONOREPO_ROOT,
        type: 'workspace-bin',
        context: {}
      });
    });
  });

  describe('getToolInfo', () => {
    it('should find existing tools', async () => {
      const git = await getToolInfo(MONOREPO_ROOT, 'git');
      expect(git).toBeDefined();
      expect(git?.name).toBe('git');
      expect(git?.type).toBe('workspace-bin');
    });

    it('should return undefined for non-existent tools', async () => {
      const nonexistent = await getToolInfo(MONOREPO_ROOT, 'nonexistenttool');
      expect(nonexistent).toBeUndefined();
    });
  });
}); 