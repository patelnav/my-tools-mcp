import { describe, it, expect } from 'vitest';
import { validateToolName, validateArgs, BLACKLISTED_TOOLS } from '@server/controllers/docs/security';

describe('Security Module', () => {
  describe('validateToolName', () => {
    it('should allow valid tool names', () => {
      const validNames = [
        'git',
        'npm',
        'pnpm',
        'node',
        'drizzle-kit',
        'pnpm drizzle-kit',
        'npm run-script',
        'cargo test',
        'go build'
      ];

      validNames.forEach(name => {
        expect(validateToolName(name)).toBe(true);
      });
    });

    it('should reject blacklisted tools', () => {
      BLACKLISTED_TOOLS.forEach(tool => {
        expect(validateToolName(tool)).toBe(false);
      });
    });

    it('should reject tool names with shell expansions', () => {
      const invalidNames = [
        'git $(echo hack)',
        'npm ${PATH}',
        'pnpm `ls`',
        'node; rm -rf /',
        'git && echo hack',
        'npm || true'
      ];

      invalidNames.forEach(name => {
        expect(validateToolName(name)).toBe(false);
      });
    });

    it('should reject tool names with path traversal', () => {
      const invalidNames = [
        '../git',
        'npm/../hack',
        '/usr/bin/git',
        'C:\\Windows\\System32\\cmd'
      ];

      invalidNames.forEach(name => {
        expect(validateToolName(name)).toBe(false);
      });
    });

    it('should reject tool names with invalid characters', () => {
      const invalidNames = [
        'git!',
        'npm#',
        'pnpm$',
        'node%',
        'git^',
        'npm&',
        'pnpm*',
        'node(',
        'git)',
        'npm=',
        'pnpm+',
        'node{',
        'git}',
        'npm[',
        'pnpm]',
        'node\\',
        'git\'',
        'npm"',
        'pnpm<',
        'node>',
        'git?',
        'npm,',
        'pnpm:',
        'node;'
      ];

      invalidNames.forEach(name => {
        expect(validateToolName(name)).toBe(false);
      });
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
}); 