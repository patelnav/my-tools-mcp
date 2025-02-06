import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as path from 'node:path';
import { validateToolName, validateArgs } from '@server/controllers/docs/security';
import { isPackageCommandAvailable } from '@server/controllers/docs/package-scanner';
import { env } from '@/env';
import { getTestMonorepoPath } from '@shared/workspace';

const MONOREPO_ROOT = getTestMonorepoPath();
const MOCK_BIN_PATH = path.join(MONOREPO_ROOT, 'bin');
const NODE_MODULES_BIN = path.join(MONOREPO_ROOT, 'node_modules', '.bin');
const MOCK_PROJECT_PATH = MONOREPO_ROOT;

describe('Security Module', () => {
  const originalPath = process.env.PATH;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeAll(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    env.setTestMode(true);
  });

  afterAll(() => {
    // Restore original environment
    process.env.PATH = originalPath;
    process.env.NODE_ENV = originalNodeEnv;
    env.setTestMode(false);
  });

  describe('validateToolName', () => {
    it('should allow valid direct tool names', async () => {
      // Set PATH to include both mock binaries and node_modules/.bin
      process.env.PATH = `${MOCK_BIN_PATH}${process.platform === 'win32' ? ';' : ':'}${NODE_MODULES_BIN}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH || ''}`;
      
      expect(await validateToolName('git', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('node', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('vite', MOCK_PROJECT_PATH)).toBe(true);
    });

    it('should allow valid package manager commands', async () => {
      expect(await validateToolName('npm:test', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('npm:build', MOCK_PROJECT_PATH)).toBe(true);
      expect(await validateToolName('pnpm:test', MOCK_PROJECT_PATH)).toBe(true);
    });

    it('should reject invalid package manager commands', async () => {
      expect(await validateToolName('npm:nonexistent', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('pnpm:nonexistent', MOCK_PROJECT_PATH)).toBe(false);
    });

    it('should reject blacklisted tools', async () => {
      expect(await validateToolName('rm', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('sudo', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('chmod', MOCK_PROJECT_PATH)).toBe(false);
    });

    it('should reject tool names with shell expansions', async () => {
      expect(await validateToolName('$(ls)', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('`ls`', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('$HOME', MOCK_PROJECT_PATH)).toBe(false);
    });

    it('should reject tool names with path traversal', async () => {
      expect(await validateToolName('../ls', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('/bin/ls', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('\\bin\\ls', MOCK_PROJECT_PATH)).toBe(false);
    });

    it('should reject tool names with invalid characters', async () => {
      expect(await validateToolName('tool;ls', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('tool|ls', MOCK_PROJECT_PATH)).toBe(false);
      expect(await validateToolName('tool>ls', MOCK_PROJECT_PATH)).toBe(false);
    });
  });

  describe('validateArgs', () => {
    it('should allow valid arguments', async () => {
      expect(await validateArgs(['--help'])).toBe(true);
      expect(await validateArgs(['-v'])).toBe(true);
      expect(await validateArgs(['test', '--coverage'])).toBe(true);
    });

    it('should reject dangerous arguments', async () => {
      expect(await validateArgs(['--exec=rm -rf /'])).toBe(false);
      expect(await validateArgs(['$(ls)'])).toBe(false);
      expect(await validateArgs(['`ls`'])).toBe(false);
    });
  });

  describe('isPackageCommandAvailable', () => {
    it('should identify available package commands', async () => {
      expect(await isPackageCommandAvailable('npm:test', MOCK_PROJECT_PATH)).toBe(true);
      expect(await isPackageCommandAvailable('npm:build', MOCK_PROJECT_PATH)).toBe(true);
    });

    it('should identify unavailable package commands', async () => {
      expect(await isPackageCommandAvailable('npm:nonexistent', MOCK_PROJECT_PATH)).toBe(false);
      expect(await isPackageCommandAvailable('pnpm:nonexistent', MOCK_PROJECT_PATH)).toBe(false);
    });
  });
}); 