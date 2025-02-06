import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { join } from 'path';
import { scanWorkspaceTools, getToolInfo, type ToolInfo, clearToolCache } from '@server/controllers/docs/path-scanner';
import { env } from '@/env';
import { getTestMonorepoPath } from '@test/shared/workspace';

const MONOREPO_ROOT = getTestMonorepoPath();
const MOCK_BIN_PATH = join(MONOREPO_ROOT, 'bin');
const NODE_MODULES_BIN = join(MONOREPO_ROOT, 'node_modules', '.bin');

describe('Package Scanner', () => {
  const originalPath = process.env.PATH;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    env.setTestMode(true);
    
    // Add both mock binaries and node_modules/.bin to PATH
    process.env.PATH = `${MOCK_BIN_PATH}${process.platform === 'win32' ? ';' : ':'}${NODE_MODULES_BIN}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`;
    
    // Clear any cached results
    clearToolCache(MONOREPO_ROOT);
  });

  afterAll(() => {
    // Restore original environment
    process.env.PATH = originalPath;
    process.env.NODE_ENV = originalNodeEnv;
    env.setTestMode(false);
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
          scriptSource: expect.stringContaining('package.json'),
          script: "echo 'test'"
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
          scriptSource: expect.stringContaining('package.json'),
          script: "echo 'build'"
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